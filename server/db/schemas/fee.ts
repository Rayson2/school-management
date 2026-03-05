import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { academicSessionsTable } from "./academicSessions";
import { classesTable } from "./classes";
import { studentsTable } from "./students";
import { usersTable } from "./users";

export const feeAdmissionTypeEnum = pgEnum("fee_admission_type", ["new", "old"]);
export const feeEntryStatusEnum = pgEnum("fee_entry_status", ["pending", "partial", "paid"]);
export const feePaymentModeEnum = pgEnum("fee_payment_mode", ["cash", "online", "cheque"]);

export const feeClassConfigsTable = pgTable(
  "fee_class_configs",
  {
    id: uuid().primaryKey().defaultRandom(),
    classId: uuid("classId")
      .notNull()
      .references(() => classesTable.id, { onDelete: "cascade" }),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => academicSessionsTable.id, { onDelete: "cascade" }),
    newAdmissionFee: integer("newAdmissionFee").notNull().default(0),
    oldAdmissionFee: integer("oldAdmissionFee").notNull().default(0),
    startMonth: integer("startMonth").notNull().default(1),
    startYear: integer("startYear").notNull().default(2025),
    endMonth: integer("endMonth").notNull().default(12),
    endYear: integer("endYear").notNull().default(2026),
    activeMonths: integer("activeMonths").notNull().default(12),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("fee_class_configs_class_session_unique").on(table.classId, table.sessionId),
    index("fee_class_configs_session_idx").on(table.sessionId),
  ],
);

export const feeStudentMonthlyTable = pgTable(
  "fee_student_monthly",
  {
    id: uuid().primaryKey().defaultRandom(),
    studentId: uuid("studentId")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    classId: uuid("classId")
      .notNull()
      .references(() => classesTable.id, { onDelete: "restrict" }),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => academicSessionsTable.id, { onDelete: "cascade" }),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    admissionType: feeAdmissionTypeEnum("admissionType").notNull(),
    amountDue: integer("amountDue").notNull().default(0),
    amountPaid: integer("amountPaid").notNull().default(0),
    status: feeEntryStatusEnum("status").notNull().default("pending"),
    paymentMode: feePaymentModeEnum("paymentMode"),
    referenceNumber: varchar("referenceNumber", { length: 120 }),
    paidAt: timestamp("paidAt", { withTimezone: true }),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    updatedBy: uuid("updatedBy")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("fee_student_monthly_unique").on(
      table.studentId,
      table.sessionId,
      table.month,
      table.year,
    ),
    index("fee_student_monthly_session_idx").on(table.sessionId, table.classId),
    index("fee_student_monthly_status_idx").on(table.status),
  ],
);

export type FeeClassConfig = typeof feeClassConfigsTable.$inferSelect;
export type FeeStudentMonthly = typeof feeStudentMonthlyTable.$inferSelect;
