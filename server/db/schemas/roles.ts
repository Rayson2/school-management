import { pgTable, uuid,text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const rolesTable = pgTable("roles", {
    id: uuid().primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    description: text("description"),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
})

export const userRolesTable = pgTable("user_roles", {
    userId: uuid().notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    roleId: uuid().notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assignedAt", { withTimezone: true }).defaultNow(),
}, (table) => [
    primaryKey({columns: [table.userId, table.roleId]})
])

export type Role = typeof rolesTable.$inferSelect;
export type UserRole = typeof userRolesTable.$inferSelect;