import z from "zod";

const envSchema = z.object({
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default(4000),
  DATABASE_URL: z.string().optional(),
});

export const Env = envSchema.parse(process.env);
