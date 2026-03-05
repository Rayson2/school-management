import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { formatErrors } from "../utils/errors";
import { HttpStatus } from "../utils/types";

const isoDateTime = z.string().datetime({ offset: true });
const isoDate = z.string().date();

const examStatusSchema = z.enum(["draft", "scheduled", "completed"]);
const examTypeSchema = z.enum(["quarterly", "half_yearly", "annual"]);

const examBaseSchema = z.object({
  examType: examTypeSchema,
  description: z.string().trim().max(2000).optional(),
  academicYear: z.string().trim().min(1).max(20).optional(),
  sessionId: z.uuid(),
  classId: z.uuid(),
  startDate: isoDateTime.optional(),
  endDate: isoDateTime.optional(),
  status: examStatusSchema.optional(),
});

const validateExamRules = (
  value: {
    startDate?: string;
    endDate?: string;
  },
  ctx: z.RefinementCtx,
) => {
  if (value.startDate && value.endDate) {
    if (new Date(value.endDate) < new Date(value.startDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be greater than or equal to start date",
      });
    }
  }

};

const createExamSchema = examBaseSchema.superRefine(validateExamRules);

const createMultiClassExamSchema = z
  .object({
    examType: examTypeSchema,
    description: z.string().trim().max(2000).optional(),
    academicYear: z.string().trim().min(1).max(20).optional(),
    sessionId: z.uuid(),
    status: examStatusSchema.optional(),
    autoEnrollStudents: z.boolean().optional(),
    classes: z
      .array(
        z
          .object({
            classId: z.uuid(),
            startDate: isoDateTime.optional(),
            endDate: isoDateTime.optional(),
            subjects: z
              .array(
                z.object({
                  subjectId: z.uuid(),
                  examDate: isoDate,
                  startTime: isoDateTime,
                  endTime: isoDateTime,
                }),
              )
              .optional(),
          })
          .superRefine(validateExamRules),
      )
      .min(1),
  })
  .superRefine((value, ctx) => {
    const classIdSet = new Set<string>();
    for (let classIndex = 0; classIndex < value.classes.length; classIndex += 1) {
      const classItem = value.classes[classIndex];
      if (classIdSet.has(classItem.classId)) {
        ctx.addIssue({
          code: "custom",
          path: ["classes", classIndex, "classId"],
          message: "Duplicate class is not allowed",
        });
      }
      classIdSet.add(classItem.classId);

      if (!classItem.subjects?.length) {
        continue;
      }
      const subjectIdSet = new Set<string>();
      for (let subjectIndex = 0; subjectIndex < classItem.subjects.length; subjectIndex += 1) {
        const subject = classItem.subjects[subjectIndex];
        if (subjectIdSet.has(subject.subjectId)) {
          ctx.addIssue({
            code: "custom",
            path: ["classes", classIndex, "subjects", subjectIndex, "subjectId"],
            message: "Duplicate subject is not allowed for a class",
          });
        }
        subjectIdSet.add(subject.subjectId);
        if (new Date(subject.endTime) <= new Date(subject.startTime)) {
          ctx.addIssue({
            code: "custom",
            path: ["classes", classIndex, "subjects", subjectIndex, "endTime"],
            message: "Subject end time must be greater than start time",
          });
        }
      }
    }
  });

const updateExamSchema = examBaseSchema.partial().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "At least one field is required for update",
    });
  }

  validateExamRules(value, ctx);
});

const enrollStudentsSchema = z.object({
  studentIds: z.array(z.uuid()).min(1),
});

const createSubjectSchema = z.object({
  sessionId: z.uuid(),
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(20),
  subjectType: z.enum(["theory", "practical", "activity"]).optional(),
});

const assignClassSubjectSchema = z.object({
  sessionId: z.uuid(),
  classId: z.uuid(),
  subjectId: z.uuid(),
  teacherId: z.uuid().optional(),
});

const updateExamComponentMarksSchema = z.object({
  entries: z
    .array(
      z
        .object({
          examSubjectId: z.uuid(),
          component: z.enum([
            "assignment_1",
            "internal_1",
            "quarterly",
            "assignment_2",
            "internal_2",
            "half_yearly",
            "theory",
            "practical_assignment",
          ]),
          maxMarks: z.number().int().positive(),
          passMarks: z.number().int().nonnegative(),
        })
        .superRefine((value, ctx) => {
          if (value.passMarks > value.maxMarks) {
            ctx.addIssue({
              code: "custom",
              path: ["passMarks"],
              message: "Pass marks cannot be greater than max marks",
            });
          }
        }),
    )
    .min(1),
});

const updateClassSubjectSchema = z
  .object({
    subjectId: z.string().uuid().optional(),
    teacherId: z.uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field is required for update",
      });
    }
  });

export const validateCreateExam = zValidator(
  "json",
  createExamSchema,
  (result, c) => {
    if (!result.success) {
      const details = formatErrors(result);
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details,
        },
        HttpStatus.BadRequest,
      );
    }
  },
);

export const validateUpdateExam = zValidator(
  "json",
  updateExamSchema,
  (result, c) => {
    if (!result.success) {
      const details = formatErrors(result);
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details,
        },
        HttpStatus.BadRequest,
      );
    }
  },
);

export const validateCreateMultiClassExam = zValidator(
  "json",
  createMultiClassExamSchema,
  (result, c) => {
    if (!result.success) {
      const details = formatErrors(result);
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details,
        },
        HttpStatus.BadRequest,
      );
    }
  },
);

export const validateEnrollStudents = zValidator(
  "json",
  enrollStudentsSchema,
  (result, c) => {
    if (!result.success) {
      const details = formatErrors(result);
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details,
        },
        HttpStatus.BadRequest,
      );
    }
  },
);

export const validateCreateSubject = zValidator(
  "json",
  createSubjectSchema,
  (result, c) => {
    if (!result.success) {
      const details = formatErrors(result);
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details,
        },
        HttpStatus.BadRequest,
      );
    }
  },
);

export const validateAssignClassSubject = zValidator(
  "json",
  assignClassSubjectSchema,
  (result, c) => {
    if (!result.success) {
      const details = formatErrors(result);
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details,
        },
        HttpStatus.BadRequest,
      );
    }
  },
);

export const validateUpdateClassSubject = zValidator(
  "json",
  updateClassSubjectSchema,
  (result, c) => {
    if (!result.success) {
      const details = formatErrors(result);
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details,
        },
        HttpStatus.BadRequest,
      );
    }
  },
);

export const validateUpdateExamComponentMarks = zValidator(
  "json",
  updateExamComponentMarksSchema,
  (result, c) => {
    if (!result.success) {
      const details = formatErrors(result);
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details,
        },
        HttpStatus.BadRequest,
      );
    }
  },
);
