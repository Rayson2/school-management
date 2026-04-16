import { integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const leaveApplicantRoleEnum = pgEnum("leave_applicant_role", [
  "student",
  "teacher",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
]);

export const leaveRequestsTable = pgTable("leave_requests", {
  id: uuid().primaryKey().defaultRandom(),
  applicantUserId: uuid("applicantUserId")
    .notNull()
    .references(() => usersTable.id),
  applicantRole: leaveApplicantRoleEnum("applicantRole").notNull(),
  leaveType: varchar("leaveType", { length: 50 }).notNull(),
  startDate: timestamp("startDate", { withTimezone: true }).notNull(),
  endDate: timestamp("endDate", { withTimezone: true }).notNull(),
  totalDays: integer("totalDays").notNull(),
  reason: text("reason").notNull(),
  status: leaveStatusEnum("status").notNull().default("pending"),
  adminRemarks: text("adminRemarks"),
  reviewedByUserId: uuid("reviewedByUserId").references(() => usersTable.id),
  reviewedAt: timestamp("reviewedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(() => new Date()),
});

export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
export type NewLeaveRequest = typeof leaveRequestsTable.$inferInsert;
