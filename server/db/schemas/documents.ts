import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { usersTable } from "./users";
import { documentRequestTypesTable } from "./documentRequests";

export const documentsTable = pgTable("documents", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("userId").notNull().references(() => usersTable.id),
  requestTypeId: uuid("requestTypeId").references(() => documentRequestTypesTable.id),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
  fileSize: varchar("fileSize", { length: 50 }),
  fileType: varchar("fileType", { length: 50 }), // pdf, image, doc, etc
  documentType: varchar("documentType", { length: 100 }).notNull(), // "certificate", "transcript", "id_proof", etc
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  uploadedAt: timestamp("uploadedAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(() => new Date()),
});

export const documentsRelations = relations(documentsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [documentsTable.userId],
    references: [usersTable.id],
  }),
  requestType: one(documentRequestTypesTable, {
    fields: [documentsTable.requestTypeId],
    references: [documentRequestTypesTable.id],
  }),
}));

export type Document = typeof documentsTable.$inferSelect;
