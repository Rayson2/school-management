import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const teachersTable = pgTable("teachers", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("userId").notNull().references(() => usersTable.id),
  mobileNo: varchar("mobileNo", { length: 20 }).notNull(),
  fathersName: varchar("fathersName", { length: 255 }).notNull(),
  mothersName: varchar("mothersName", { length: 255 }).notNull(),
  dateOfBirth: timestamp("dateOfBirth").notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  aadharCard: varchar("aadharCard", { length: 50 }).notNull(),
  panCard: varchar("panCard", { length: 50 }).notNull(),
  emailId: varchar("emailId", { length: 255 }).notNull(),
  designation: varchar("designation", { length: 255 }).notNull(),
  qualification: varchar("qualification", { length: 255 }).notNull(),
  accountNo: varchar("accountNo", { length: 50 }).notNull(),
  bankIfsc: varchar("bankIfsc", { length: 20 }).notNull(),
  bankName: varchar("bankName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(() => new Date()),
});

export type Teacher = typeof teachersTable.$inferSelect;
export type NewTeacher = typeof teachersTable.$inferInsert;
