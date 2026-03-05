import { db } from "../db";
import { rolesTable } from "../db/schemas/roles";

export const seedRoles = async () => {
  const existingRoles = await db.select().from(rolesTable);

  if (existingRoles.length === 0) {
    await db.insert(rolesTable).values([
      {
        name: "admin",
        description: "Administrator with full system access",
      },
      {
        name: "teacher",
        description: "Teacher can manage assignments and grades",
      },
      {
        name: "student",
        description: "Student can view assignments and submit work",
      },
    ]);
    console.log("✓ Roles seeded successfully");
  } else {
    console.log("Roles already exist. Skipping.");
  }
};
