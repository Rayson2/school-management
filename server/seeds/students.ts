import { hashSync } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { usersTable } from "../db/schemas/users";
import { studentsTable } from "../db/schemas/students";
import { classesTable } from "../db/schemas/classes";
import { academicSessionsTable } from "../db/schemas/academicSessions";
import { rolesTable, userRolesTable } from "../db/schemas/roles";
import { eq } from "drizzle-orm";
import { Role } from "../utils/roles";
import { db } from "../db";
export async function seedStudents() {
	try {
		await db.transaction(async (tx) => {
			// Ensure student role exists
			const [studentRole] = await tx.select().from(rolesTable).where(eq(rolesTable.name, Role.STUDENT)).limit(1);
			let [session] = await tx
				.select({ id: academicSessionsTable.id })
				.from(academicSessionsTable)
				.where(eq(academicSessionsTable.name, "2025-2026"))
				.limit(1);

			if (!session) {
				[session] = await tx
					.insert(academicSessionsTable)
					.values({ name: "2025-2026" })
					.returning({ id: academicSessionsTable.id });
			}

			for (let i = 1; i <= 10; i++) {
				const username = `student${i}`;
				const fullName = `Student ${i}`;
				const password = hashSync("password123", 12);

				// create user
				const [newUser] = await tx.insert(usersTable).values({
					id: uuidv4(),
					fullName,
					username,
					password,
				}).returning();

				// assign student role (if role exists)
				if (studentRole) {
					await tx.insert(userRolesTable).values({
						userId: newUser.id,
						roleId: studentRole.id,
					});
				}

				// create student record
				const className = `Class ${((i - 1) % 5) + 1}`;
				let classId = "";
				const existingClass = await tx
					.select({ id: classesTable.id })
					.from(classesTable)
					.where(eq(classesTable.name, className))
					.limit(1);

				if (existingClass.length > 0) {
					classId = existingClass[0].id;
				} else {
					const [createdClass] = await tx
						.insert(classesTable)
						.values({ name: className })
						.returning({ id: classesTable.id });
					classId = createdClass.id;
				}

				await tx.insert(studentsTable).values({
					id: uuidv4(),
					userId: newUser.id,
					rollNumber: `RN${1000 + i}`,
					admissionNo: `ADM${2000 + i}`,
					admissionDate: new Date(),
					fathersName: `Father ${i}`,
					mothersName: `Mother ${i}`,
					sessionId: session.id,
					classId,
					parentEmail: `parent${i}@example.com`,
					parentPhone: `99900000${String(i).padStart(2, "0")}`,
					dateOfBirth: new Date(2010, (i % 12), 1),
					bloodGroup: "O+",
					gender: i % 2 === 0 ? "Male" : "Female",
					penNo: `PEN${3000 + i}`,
					aadharNo: `AADHAR${4000 + i}`,
					category: "General",
					aaparId: `AAPAR${5000 + i}`,
					address: `123 Street ${i}`,
					mobileNo: `70000000${String(i).padStart(2, "0")}`,
				});
			}
		});
	} catch (err) {
		console.error("Error seeding students:", err);
		throw err;
	}
}
