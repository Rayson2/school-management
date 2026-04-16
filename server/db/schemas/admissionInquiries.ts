import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const admissionInquiryStatusEnum = pgEnum("admission_inquiry_status", [
  "new",
  "contacted",
  "converted",
  "rejected",
]);

export const admissionInquiriesTable = pgTable(
  "admission_inquiries",
  {
    id: uuid().primaryKey().defaultRandom(),
    inquiryId: varchar("inquiryId", { length: 40 }).notNull(),
    fullName: varchar("fullName", { length: 255 }).notNull(),
    dateOfBirth: timestamp("dateOfBirth", { withTimezone: true }).notNull(),
    gender: varchar("gender", { length: 30 }).notNull(),
    age: integer("age").notNull(),
    previousSchoolName: varchar("previousSchoolName", { length: 255 }),
    currentClassLastStudied: varchar("currentClassLastStudied", { length: 100 }),
    applyingForClass: varchar("applyingForClass", { length: 100 }).notNull(),
    sessionName: varchar("sessionName", { length: 100 }).notNull(),
    mediumOfInstruction: varchar("mediumOfInstruction", { length: 50 }).notNull(),
    fatherName: varchar("fatherName", { length: 255 }),
    motherName: varchar("motherName", { length: 255 }),
    guardianName: varchar("guardianName", { length: 255 }),
    primaryContactNumber: varchar("primaryContactNumber", { length: 20 }).notNull(),
    alternateContactNumber: varchar("alternateContactNumber", { length: 20 }),
    emailAddress: varchar("emailAddress", { length: 255 }),
    fatherOccupation: varchar("fatherOccupation", { length: 150 }),
    motherOccupation: varchar("motherOccupation", { length: 150 }),
    fullAddress: text("fullAddress").notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 100 }).notNull(),
    pinCode: varchar("pinCode", { length: 20 }).notNull(),
    specialNeedsMedicalConditions: text("specialNeedsMedicalConditions"),
    remarksQuestions: text("remarksQuestions"),
    status: admissionInquiryStatusEnum("status").notNull().default("new"),
    assignedStaffUserId: uuid("assignedStaffUserId").references(() => usersTable.id),
    followUpDate: timestamp("followUpDate", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
      () => new Date(),
    ),
  },
  (table) => [uniqueIndex("admission_inquiries_inquiry_id_unique").on(table.inquiryId)],
);

export type AdmissionInquiry = typeof admissionInquiriesTable.$inferSelect;
export type NewAdmissionInquiry = typeof admissionInquiriesTable.$inferInsert;
