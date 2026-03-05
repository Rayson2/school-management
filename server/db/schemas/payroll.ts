import { index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { academicSessionsTable } from "./academicSessions";
import { teachersTable } from "./teachers";

export const payrollStatusEnum = pgEnum("payroll_status", ["pending", "paid"]);

export const payrollTable = pgTable(
  "payroll",
  {
    id: uuid().primaryKey().defaultRandom(),
    teacherId: uuid("teacherId")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => academicSessionsTable.id, { onDelete: "restrict" }),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    basicSalary: integer("basicSalary").notNull().default(0),
    transportAllowance: integer("transportAllowance").notNull().default(0),
    otherAllowances: integer("otherAllowances").notNull().default(0),
    deductions: integer("deductions").notNull().default(0),
    grossSalary: integer("grossSalary").notNull().default(0),
    netSalary: integer("netSalary").notNull().default(0),
    status: payrollStatusEnum("status").notNull().default("pending"),
    paidAt: timestamp("paidAt", { withTimezone: true }),
    paymentMode: varchar("paymentMode", { length: 50 }),
    transactionRef: varchar("transactionRef", { length: 120 }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("payroll_teacher_session_month_year_unique").on(
      table.teacherId,
      table.sessionId,
      table.month,
      table.year,
    ),
    index("payroll_session_idx").on(table.sessionId, table.month, table.year),
    index("payroll_teacher_idx").on(table.teacherId),
    index("payroll_status_idx").on(table.status),
  ],
);

export type Payroll = typeof payrollTable.$inferSelect;
export type NewPayroll = typeof payrollTable.$inferInsert;
