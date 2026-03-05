import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { formatErrors } from "../utils/errors";
import { ErrorResponse, HttpStatus } from "../utils/types";

const newTeacherSchema = z.object({
  fullName: z.string().max(255),
  mobileNo: z.string().max(20),
  fathersName: z.string().max(255),
  mothersName: z.string().max(255),
  dateOfBirth: z.string(),
  address: z.string().max(255),
  aadharCard: z.string().max(50),
  panCard: z.string().max(50),
  emailId: z.string().email().max(255),
  designation: z.string().max(255),
  qualification: z.string().max(255),
  accountNo: z.string().max(50),
  bankIfsc: z.string().max(20),
  bankName: z.string().max(255),
});

export const validateTeacherData = zValidator(
  "json",
  newTeacherSchema,
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

const updateTeacherSchema = newTeacherSchema.extend({
  password: z.string().max(255).optional(),
});

export const validateTeacherUpdateData = zValidator(
  "json",
  updateTeacherSchema,
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
