import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { classesTable } from "./classes";
import { usersTable } from "./users";

export const noticeTypeValues = ["class", "teacher", "general"] as const;
export type NoticeType = (typeof noticeTypeValues)[number];

export const noticesTable = pgTable("notices", {
  id: uuid().primaryKey().defaultRandom(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  noticeType: varchar("noticeType", { length: 20 }).notNull(),
  classId: uuid("classId").references(() => classesTable.id),
  createdByUserId: uuid("createdByUserId")
    .notNull()
    .references(() => usersTable.id),
  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentUrl: varchar("attachmentUrl", { length: 500 }),
  attachmentSize: varchar("attachmentSize", { length: 50 }),
  attachmentType: varchar("attachmentType", { length: 100 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
    () => new Date(),
  ),
});

export type Notice = typeof noticesTable.$inferSelect;
export type NewNotice = typeof noticesTable.$inferInsert;
