import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { usersTable } from "./users";

export const documentsTable = pgTable("documents", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("userId").notNull().references(() => usersTable.id),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
  fileSize: varchar("fileSize", { length: 50 }),
  fileType: varchar("fileType", { length: 50 }), // pdf, image, doc, etc
  documentType: varchar("documentType", { length: 100 }).notNull(), // "certificate", "transcript", "id_proof", etc
  uploadedAt: timestamp("uploadedAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(() => new Date()),
});

export const documentsRelations = relations(documentsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [documentsTable.userId],
    references: [usersTable.id],
  }),
}));

export type Document = typeof documentsTable.$inferSelect;