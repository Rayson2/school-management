import { pgTable, timestamp, uuid, varchar, uniqueIndex } from "drizzle-orm/pg-core";

export const classesTable = pgTable(
  "classes",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
      () => new Date(),
    ),
  },
  (table) => [uniqueIndex("classes_name_unique").on(table.name)],
);

export type Class = typeof classesTable.$inferSelect;
export type NewClass = typeof classesTable.$inferInsert;
