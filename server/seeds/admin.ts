import { eq } from "drizzle-orm";
import { db } from "../db";
import { usersTable } from "../db/schemas/users";
import { userRolesTable } from "../db/schemas/roles";
import { rolesTable } from "../db/schemas/roles";
import { hashSync } from "bcryptjs";
import { Role } from "../utils/roles";


const superUser = {
  fullName: "My Admin",
  username: "admin",
  password: hashSync("admin123", 12),
};

export async function seedSuperUser() {
  const existingUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, superUser.username!));

  try {
    if (existingUser.length === 0) {
      const user = await db.insert(usersTable).values(superUser).returning();
      
      // Assign admin role
      const adminRole = await db
        .select()
        .from(rolesTable)
        .where(eq(rolesTable.name, Role.ADMIN));

      if (adminRole.length > 0) {
        await db.insert(userRolesTable).values({
          userId: user[0].id,
          roleId: adminRole[0].id,
        });
      }

      console.log("✓ Super user created successfully.");
    } else {
      console.log("Super user already exists. Skipping seeding.");
    }
  } catch (error) {
    console.error("Error seeding super user:", error);
    throw error;
  }
}
