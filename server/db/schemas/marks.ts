import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  examSubjectsTable,
  examsTable,
  resultComponentEnum,
  subjectsTable,
} from "./exams";
import { studentsTable } from "./students";
import { usersTable } from "./users";

export const marksTable = pgTable(
  "marks",
  {
    id: uuid().primaryKey().defaultRandom(),
    examId: uuid("examId")
      .notNull()
      .references(() => examsTable.id, { onDelete: "cascade" }),
    studentId: uuid("studentId")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    subjectId: uuid("subjectId")
      .notNull()
      .references(() => subjectsTable.id, { onDelete: "cascade" }),
    marksObtained: integer("marksObtained").notNull(),
    gradedBy: uuid("gradedBy")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("marks_exam_student_subject_unique").on(
      table.examId,
      table.studentId,
      table.subjectId,
    ),
    index("marks_exam_idx").on(table.examId),
    index("marks_student_idx").on(table.studentId),
  ],
);

export type Mark = typeof marksTable.$inferSelect;

export const studentMarksTable = pgTable(
  "student_marks",
  {
    id: uuid().primaryKey().defaultRandom(),
    studentId: uuid("studentId")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    examSubjectId: uuid("examSubjectId")
      .notNull()
      .references(() => examSubjectsTable.id, { onDelete: "cascade" }),
    component: resultComponentEnum("component").notNull(),
    obtainedMarks: integer("obtainedMarks").notNull(),
    gradedBy: uuid("gradedBy")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("student_marks_student_exam_subject_unique").on(
      table.studentId,
      table.examSubjectId,
      table.component,
    ),
    index("student_marks_exam_subject_idx").on(table.examSubjectId),
    index("student_marks_student_idx").on(table.studentId),
  ],
);

export type StudentMark = typeof studentMarksTable.$inferSelect;
