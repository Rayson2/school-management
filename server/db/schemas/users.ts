import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { documentsTable } from "./documents";
import { relations } from "drizzle-orm/relations";

export const usersTable = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  avatarUrl: varchar("avatarUrl", { length: 255 }),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
    () => new Date(),
  ),
});

export const usersRelations = relations(usersTable, ({ many }) => ({
  documents: many(documentsTable),
}));

export type User = typeof usersTable.$inferSelect;
