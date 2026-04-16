import { boolean, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { classesTable } from "./classes";

export const studentUploadControlsTable = pgTable("student_upload_controls", {
  id: uuid().primaryKey(),
  scopeType: varchar("scopeType", { length: 20 }).notNull(), // all | class
  classId: uuid("classId").references(() => classesTable.id),
  requestedDocumentTypes: text("requestedDocumentTypes"),
  documentUploadEnabled: boolean("documentUploadEnabled").notNull().default(false),
  profileUploadEnabled: boolean("profileUploadEnabled").notNull().default(false),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(() => new Date()),
});

export type StudentUploadControl = typeof studentUploadControlsTable.$inferSelect;
