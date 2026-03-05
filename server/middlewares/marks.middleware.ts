import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { formatErrors } from "../utils/errors";
import { HttpStatus } from "../utils/types";

const markEntrySchema = z.object({
  studentId: z.string().uuid(),
  examSubjectId: z.string().uuid(),
  subjectId: z.string().uuid().optional(),
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
  obtainedMarks: z.number().int().nonnegative(),
});

const enterMarksSchema = z.object({
  examId: z.string().uuid().optional(),
  entries: z.array(markEntrySchema).min(1),
});

const updateMarkSchema = z.object({
  obtainedMarks: z.number().int().nonnegative(),
});

const bulkUpdateMarksSchema = z.object({
  entries: z
    .array(
      z.object({
        markId: z.string().uuid(),
        obtainedMarks: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export const validateEnterMarks = zValidator(
  "json",
  enterMarksSchema,
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

export const validateUpdateMark = zValidator(
  "json",
  updateMarkSchema,
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

export const validateBulkUpdateMarks = zValidator(
  "json",
  bulkUpdateMarksSchema,
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
