import { deleteCookie, getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { ErrorResponse, HttpStatus } from "../utils/types";
import { db } from "../db";
import { sessionTable } from "../db/schemas/sessions";
import { usersTable } from "../db/schemas/users";
import { gt, eq, and } from "drizzle-orm";
import { rolesTable, userRolesTable } from "../db/schemas/roles";
import { getUserRoles } from "../utils/roles";

export const requireAuth = createMiddleware(async (c, next) => {
  const sessionCookie = getCookie(c, "session");
  if (!sessionCookie) {
    return c.json<ErrorResponse>(
      { success: false, error: "Unauthorized" },
      HttpStatus.Unauthorized,
    );
  }

  // Single join query to get session and user
  const result = await db
    .select({ session: sessionTable, user: usersTable })
    .from(sessionTable)
    .innerJoin(usersTable, eq(sessionTable.userId, usersTable.id))
    .where(
      and(
        eq(sessionTable.token, sessionCookie),
        gt(sessionTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (result.length === 0) {
    // Session is invalid or expired, clean up cookie and session if exists
    await db.delete(sessionTable).where(eq(sessionTable.token, sessionCookie));
    deleteCookie(c, "session");
    return c.json<ErrorResponse>(
      { success: false, error: "Invalid or Expired Session!" },
      HttpStatus.Unauthorized,
    );
  }

  const { password: _, ...userWithoutPassword } = result[0].user;
  const roles = await getUserRoles(userWithoutPassword.id);
  
  c.set("user", userWithoutPassword);
  c.set("userRole", roles);
  await next();
});

export const requireRoles = (allowedRoles: string[]) => {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json<ErrorResponse>(
        { success: false, error: "Unauthorized" },
        HttpStatus.Unauthorized,
      );
    }

    const userRoles = await getUserRoles(user.id);
    const hasRole = userRoles.some((role) =>
      allowedRoles.includes(role),
    );

    if (!hasRole) {
      return c.json<ErrorResponse>(
        { success: false, error: "Forbidden" },
        HttpStatus.Forbidden,
      );
    }

    await next();
  });
}
