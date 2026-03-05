import { seedRoles } from "./roles";
import { seedSuperUser } from "./admin";
import { seedStudents } from "./students";

async function runSeeds() {
  try {
    console.log("Starting seeds...");
    await seedRoles();
    await seedSuperUser();
    // await seedStudents();
    console.log("✓ All seeds completed successfully");
  } catch (error) {
    console.error("✖ Seed failed:", error);
    process.exit(1);
  }
}

runSeeds();
