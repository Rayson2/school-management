import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { classesTable } from "./classes";
import { academicSessionsTable } from "./academicSessions";

export const studentsTable = pgTable("students", {
  id           : uuid().primaryKey().defaultRandom(),
  userId       : uuid("userId").notNull().references(() => usersTable.id),
  rollNumber   : varchar("rollNumber", { length: 50 }).notNull().unique(),
  enrollmentNo : varchar("enrollmentNo", { length: 100 }).unique(),
  admissionNo  : varchar("admissionNo", { length: 100 }),
  admissionDate: timestamp("admissionDate"),
  fathersName  : varchar("fathersName", { length: 255 }).notNull(),
  mothersName  : varchar("mothersName", { length: 255 }).notNull(),
  sessionId    : uuid("sessionId").notNull().references(() => academicSessionsTable.id),
  classId      : uuid("classId").notNull().references(() => classesTable.id),
  parentEmail  : varchar("parentEmail", { length: 255 }),
  parentPhone  : varchar("parentPhone", { length: 20 }),
  dateOfBirth  : timestamp("dateOfBirth").notNull(),
  bloodGroup   : varchar("bloodGroup", { length: 10 }),
  gender       : varchar("gender", { length: 20 }).notNull(),
  penNo        : varchar("penNo", { length: 50 }),
  aadharNo     : varchar("aadharNo", { length: 50 }),
  category     : varchar("category", { length: 50 }).notNull(),
  aaparId      : varchar("aaparId", { length: 50 }),
  address      : varchar("address", { length: 255 }),
  mobileNo     : varchar("mobileNo", { length: 20 }),
  createdAt    : timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt    : timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(() => new Date()),
}
);

export type Student = typeof studentsTable.$inferSelect;
export type NewStudent = typeof studentsTable.$inferInsert;
