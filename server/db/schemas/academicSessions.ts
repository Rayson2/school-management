import { pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const academicSessionsTable = pgTable(
  "academic_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    enrollmentPrefix: varchar("enrollmentPrefix", { length: 20 }).notNull().default("ENR"),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
      () => new Date(),
    ),
  },
  (table) => [uniqueIndex("academic_sessions_name_unique").on(table.name)],
);

export type AcademicSession = typeof academicSessionsTable.$inferSelect;
export type NewAcademicSession = typeof academicSessionsTable.$inferInsert;
