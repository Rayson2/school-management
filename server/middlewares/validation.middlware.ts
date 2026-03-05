import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { ErrorResponse, HttpStatus } from "../utils/types";
import { formatErrors } from "../utils/errors";

export const loginSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
})



export const validateLogin = zValidator("json", loginSchema, (result, c) => {
  if (!result.success) {
    const errorList = formatErrors(result);

    return c.json<ErrorResponse>(
      {
        success: false,
        error: errorList, 
      },
      HttpStatus.BadRequest
    );
  }

});