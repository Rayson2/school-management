import { db } from "../db";
import { rolesTable, userRolesTable } from "../db/schemas/roles";
import { eq } from "drizzle-orm";

export enum Role {
  ADMIN = "admin",
  TEACHER = "teacher",
  STUDENT = "student",
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const userRoles = await db
    .select({
      roleName: rolesTable.name,
    })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, userId));

  return userRoles.map((ur) => ur.roleName);
}
