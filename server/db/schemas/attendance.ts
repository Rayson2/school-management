import {
  boolean,
  date,
  doublePrecision,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { usersTable } from "./users";

export const attendanceFeatureConfigTable = pgTable("attendance_feature_config", {
  id: uuid().primaryKey().defaultRandom(),
  schoolLatitude: doublePrecision("schoolLatitude"),
  schoolLongitude: doublePrecision("schoolLongitude"),
  allowedRadiusMeters: integer("allowedRadiusMeters").notNull().default(150),
  autoDisableMinutes: integer("autoDisableMinutes").notNull().default(60),
  isFeatureEnabled: boolean("isFeatureEnabled").notNull().default(false),
  enabledAt: timestamp("enabledAt", { withTimezone: true }),
  activeUntil: timestamp("activeUntil", { withTimezone: true }),
  isFutureScheduleEnabled: boolean("isFutureScheduleEnabled").notNull().default(true),
  updatedByUserId: uuid("updatedByUserId").references(() => usersTable.id),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
    () => new Date(),
  ),
});

export const attendanceScheduleActionValues = ["on", "off"] as const;
export type AttendanceScheduleAction =
  (typeof attendanceScheduleActionValues)[number];

export const attendanceSchedulesTable = pgTable("attendance_schedules", {
  id: uuid().primaryKey().defaultRandom(),
  action: varchar("action", { length: 10 }).notNull(),
  triggerAt: timestamp("triggerAt", { withTimezone: true }).notNull(),
  durationMinutes: integer("durationMinutes"),
  isProcessed: boolean("isProcessed").notNull().default(false),
  processedAt: timestamp("processedAt", { withTimezone: true }),
  note: varchar("note", { length: 255 }),
  createdByUserId: uuid("createdByUserId")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
    () => new Date(),
  ),
});

export const attendanceMethodValues = ["auto", "manual"] as const;
export type AttendanceMethod = (typeof attendanceMethodValues)[number];

export const teacherAttendanceTable = pgTable("teacher_attendance", {
  id: uuid().primaryKey().defaultRandom(),
  teacherId: uuid("teacherId")
    .notNull()
    .references(() => teachersTable.id),
  userId: uuid("userId")
    .notNull()
    .references(() => usersTable.id),
  attendanceDate: date("attendanceDate", { mode: "string" }).notNull(),
  checkInAt: timestamp("checkInAt", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("present"),
  method: varchar("method", { length: 20 }).notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  distanceMeters: integer("distanceMeters"),
  markedByUserId: uuid("markedByUserId").references(() => usersTable.id),
  remarks: varchar("remarks", { length: 255 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
    () => new Date(),
  ),
});

export type AttendanceFeatureConfig = typeof attendanceFeatureConfigTable.$inferSelect;
export type AttendanceSchedule = typeof attendanceSchedulesTable.$inferSelect;
export type TeacherAttendance = typeof teacherAttendanceTable.$inferSelect;
