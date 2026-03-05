import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { formatErrors } from "../utils/errors";
import { ErrorResponse, HttpStatus } from "../utils/types";

const studentBaseSchema = z.object({
  fullName: z.string().max(255),
  avatarUrl: z.string().max(255).optional(),
  rollNumber: z.string().max(50).optional(),
  enrollmentNo: z.string().max(100).optional(),
  admissionNo: z.string().max(100),
  admissionDate: z.string(),
  sessionId: z.string().uuid().optional(),
  sessionName: z.string().max(100).optional(),
  classId: z.string().uuid().optional(),
  className: z.string().max(100).optional(),
  gender: z.string().max(20),
  category: z.string().max(50),
  dateOfBirth: z.string(),
  fathersName: z.string().max(255),
  mothersName: z.string().max(255),
  mobileNo: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  parentPhone: z.string().max(20).optional(),
  aaparId: z.string().max(50).optional(),
  aadharNo: z.string().max(50).optional(),
  parentEmail: z.string().email().max(255).optional(),
  bloodGroup: z.string().max(10).optional(),
  penNo: z.string().max(50).optional(),
});

const withClassValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((value, ctx) => {
    const payload = value as {
      sessionId?: string;
      sessionName?: string;
      classId?: string;
      className?: string;
    };

    if (!payload.sessionId && !payload.sessionName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionId"],
        message: "Either sessionId or sessionName is required",
      });
    }

    if (!payload.classId && !payload.className) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["classId"],
        message: "Either classId or className is required",
      });
    }
  });

const newStudentSchema = withClassValidation(
  studentBaseSchema,
);

const updateStudentSchema = withClassValidation(
  studentBaseSchema,
);

export const validateStudentData = zValidator(
  "json",
  newStudentSchema,
  (result, c) => {
    if (!result.success) {
      const errorList = formatErrors(result);
      return c.json<ErrorResponse>(
        {
          success: false,
          error: errorList,
        },
        HttpStatus.BadRequest,
      );
    }
  },
);

export const validateStudentUpdateData = zValidator(
  "json",
  updateStudentSchema,
  (result, c) => {
    if (!result.success) {
      const errorList = formatErrors(result);
      return c.json<ErrorResponse>(
        {
          success: false,
          error: errorList,
        },
        HttpStatus.BadRequest,
      );
    }
  },
);
