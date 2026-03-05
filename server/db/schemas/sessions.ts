import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const sessionTable = pgTable("sessions", {
    id       : uuid().primaryKey().defaultRandom(),
    token    : text().notNull(),
    expiresAt: timestamp({withTimezone: true}).notNull(),
    userId   : uuid().notNull().references(() => usersTable.id, {onDelete: "cascade"}),
    createdAt: timestamp({withTimezone: true}).defaultNow(),
    updatedAt: timestamp({withTimezone: true}).$onUpdateFn(() => new Date()),
});