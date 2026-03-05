import { type User } from "./db/schemas/users";

declare module "hono" {
  interface ContextVariableMap {
    user: Omit<User, "password">;
    userRole: string[];
  }
}
