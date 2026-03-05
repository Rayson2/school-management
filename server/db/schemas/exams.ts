import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  text,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { studentsTable } from "./students";
import { academicSessionsTable } from "./academicSessions";
import { classesTable } from "./classes";
import { teachersTable } from "./teachers";

export const examStatusEnum = pgEnum("exam_status", [
  "draft",
  "scheduled",
  "completed",
]);
export const examTypeEnum = pgEnum("exam_type", [
  "quarterly",
  "half_yearly",
  "annual",
]);
export const resultComponentEnum = pgEnum("result_component", [
  "assignment_1",
  "internal_1",
  "quarterly",
  "assignment_2",
  "internal_2",
  "half_yearly",
  "theory",
  "practical_assignment",
]);

export const examsTable = pgTable(
  "exams",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => academicSessionsTable.id),
    examGroupId: uuid("examGroupId"),
    classId: uuid("classId")
      .notNull()
      .references(() => classesTable.id),
    name: varchar("name", { length: 255 }).notNull(),
    examType: examTypeEnum("examType").notNull(),
    description: text("description"),
    academicYear: varchar("academicYear", { length: 20 }).notNull(),
    startDate: timestamp("startDate", { withTimezone: true }),
    endDate: timestamp("endDate", { withTimezone: true }),
    status: examStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("exams_session_class_exam_type_unique").on(
      table.sessionId,
      table.classId,
      table.examType,
    ),
    index("exams_exam_group_idx").on(table.examGroupId),
  ],
);

export const subjectTypeEnum = pgEnum("subject_type", [
  "theory",
  "practical",
  "activity",
]);

export const subjectsTable = pgTable(
  "subjects",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => academicSessionsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    subjectType: subjectTypeEnum("subjectType"),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("subjects_session_name_unique").on(table.sessionId, table.name),
  ],
);

export const classSubjectsTable = pgTable(
  "class_subjects",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => academicSessionsTable.id, { onDelete: "cascade" }),
    classId: uuid("classId")
      .notNull()
      .references(() => classesTable.id, { onDelete: "cascade" }),
    subjectId: uuid("subjectId")
      .notNull()
      .references(() => subjectsTable.id, { onDelete: "cascade" }),
    teacherId: uuid("teacherId").references(() => teachersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("class_subjects_session_class_subject_unique").on(
      table.sessionId,
      table.classId,
      table.subjectId,
    ),
    index("class_subjects_class_idx").on(table.classId),
    index("class_subjects_subject_idx").on(table.subjectId),
  ],
);

export const examSubjectsTable = pgTable(
  "exam_subjects",
  {
    id: uuid().primaryKey().defaultRandom(),
    examId: uuid("examId")
      .notNull()
      .references(() => examsTable.id, { onDelete: "cascade" }),
    subjectId: uuid("subjectId")
      .notNull()
      .references(() => subjectsTable.id, { onDelete: "cascade" }),
    maxMarks: integer("maxMarks").notNull(),
    passMarks: integer("passMarks").notNull(),
    examDate: timestamp("examDate", { withTimezone: true }),
    startTime: timestamp("startTime", { withTimezone: true }),
    endTime: timestamp("endTime", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("exam_subjects_exam_subject_unique").on(
      table.examId,
      table.subjectId,
    ),
    index("exam_subjects_exam_idx").on(table.examId),
  ],
);

export const studentExamEnrollmentsTable = pgTable(
  "student_exam_enrollments",
  {
    id: uuid().primaryKey().defaultRandom(),
    examId: uuid("examId")
      .notNull()
      .references(() => examsTable.id, { onDelete: "cascade" }),
    studentId: uuid("studentId")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("exam_enrollments_exam_student_unique").on(
      table.examId,
      table.studentId,
    ),
  ],
);

export const examSubjectComponentsTable = pgTable(
  "exam_subject_components",
  {
    id: uuid().primaryKey().defaultRandom(),
    examSubjectId: uuid("examSubjectId")
      .notNull()
      .references(() => examSubjectsTable.id, { onDelete: "cascade" }),
    component: resultComponentEnum("component").notNull(),
    maxMarks: integer("maxMarks").notNull(),
    passMarks: integer("passMarks").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("exam_subject_components_subject_component_unique").on(
      table.examSubjectId,
      table.component,
    ),
    index("exam_subject_components_exam_subject_idx").on(table.examSubjectId),
  ],
);

export type Exam = typeof examsTable.$inferSelect;
export type Subject = typeof subjectsTable.$inferSelect;
export type ClassSubject = typeof classSubjectsTable.$inferSelect;
export type ExamSubject = typeof examSubjectsTable.$inferSelect;
export type StudentExamEnrollment =
  typeof studentExamEnrollmentsTable.$inferSelect;
export type ExamSubjectComponent = typeof examSubjectComponentsTable.$inferSelect;
