import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { randomUUID } from "crypto";
import { mkdir, readdir, unlink } from "fs/promises";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import * as path from "path";
import z from "zod";
import { db } from "../db";
import { academicSessionsTable } from "../db/schemas/academicSessions";
import { classesTable } from "../db/schemas/classes";
import {
  admitCardAccessModeEnum,
  examAdmitCardControlsTable,
  examSubjectComponentsTable,
  examsTable,
  examSubjectsTable,
  studentExamEnrollmentsTable,
  subjectsTable,
} from "../db/schemas/exams";
import { studentMarksTable } from "../db/schemas/marks";
import { studentsTable } from "../db/schemas/students";
import { usersTable } from "../db/schemas/users";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import {
  COMPONENT_LABELS,
  EXAM_TYPE_LABELS,
  type ExamType,
  type ResultComponent,
  getComponentsForExamType,
} from "../utils/exam-structure";
import {
  evaluateStudentAdmitCardAccess,
  evaluateStudentResultAccess,
  getExamAdmitCardControlContext,
  getExamAdmitCardStudentStatuses,
} from "../utils/admit-card-control";
import { Role } from "../utils/roles";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";

const resultsRouter = new Hono();
const uploadRootDir = path.join(process.cwd(), "server", "upload");
const resultsLogoDir = path.join(uploadRootDir, "results-logo");

const examParamSchema = z.object({
  examId: z.string().uuid(),
});

const admitCardQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
});

const admitCardControlUpdateSchema = z.object({
  mode: z.enum(admitCardAccessModeEnum.enumValues),
  newStudentAmount: z.coerce.number().int().min(0),
  oldStudentAmount: z.coerce.number().int().min(0),
});

const resultControlUpdateSchema = z.object({
  resultMode: z.enum(admitCardAccessModeEnum.enumValues),
});

const marksheetParamSchema = z.object({
  studentId: z.string().uuid(),
  examId: z.string().uuid(),
});

type SubjectComponentResult = {
  component: string;
  componentLabel: string;
  maxMarks: number;
  passMarks: number;
  obtainedMarks: number | null;
  status: "pass" | "fail" | "pending";
};

type SubjectResultItem = {
  examSubjectId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  components: SubjectComponentResult[];
  totalObtained: number;
  totalMax: number;
  totalPass: number;
  status: "pass" | "fail" | "pending";
};

type ExamResultItem = {
  examId: string;
  examName: string;
  examType: ExamType;
  examTypeLabel: string;
  academicYear: string;
  className: string;
  sessionName: string;
  startDate: Date | null;
  endDate: Date | null;
  totalObtained: number;
  totalMax: number;
  totalPass: number;
  percentage: number;
  grade: string;
  division: string;
  status: "pass" | "fail" | "pending";
  subjects: SubjectResultItem[];
};

type OfficialMarksheetData = {
  header: {
    boardName: string;
    examinationTitle: string;
    certificateTitle: string;
    certificateNumber: string;
    rollNumber: string;
    enrollmentNo: string;
    logoUrl: string | null;
  };
  student: {
    studentId: string;
    fullName: string;
    avatarUrl: string | null;
    fathersName: string;
    mothersName: string;
    dateOfBirth: Date | string | null;
    category: string;
    className: string;
    schoolName: string;
    examCenter: string;
  };
  exam: {
    examId: string;
    examName: string;
    examType: ExamType;
    examTypeLabel: string;
    sessionName: string;
    academicYear: string;
    startDate: Date | null;
    endDate: Date | null;
  };
  statementColumns: Array<{ examType: ExamType; label: string }>;
  componentColumns: Array<{ component: ResultComponent; label: string }>;
  marks: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    schemeMax: number;
    schemeMin: number;
    componentMarks: Partial<Record<ResultComponent, number | null>>;
    marksByType: Partial<Record<ExamType, number | null>>;
    total: number;
  }>;
  totalsByComponent: Partial<Record<ResultComponent, number>>;
  totalsByExamType: Partial<Record<ExamType, { obtained: number; max: number }>>;
  examSummaries: Array<{
    examType: ExamType;
    examTypeLabel: string;
    examId: string | null;
    examName: string | null;
    totalMarks: number;
    totalMax: number;
    percentage: number;
    grade: string;
    status: "pass" | "fail" | "pending";
    hasData: boolean;
  }>;
  summary: {
    totalMarks: number;
    totalMax: number;
    totalPass: number;
    percentage: number;
    division: string;
    grade: string;
    status: "pass" | "fail" | "pending";
  };
};

const EXAM_TYPE_SEQUENCE: ExamType[] = ["quarterly", "half_yearly", "annual"];

const getIncludedExamTypes = (examType: ExamType) => {
  const index = EXAM_TYPE_SEQUENCE.indexOf(examType);
  return index >= 0 ? EXAM_TYPE_SEQUENCE.slice(0, index + 1) : [examType];
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const formatDateLabel = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
};

const formatDayLabel = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  });
};

const formatTimeLabel = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

const getGradeFromPercentage = (percentage: number) => {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C+";
  if (percentage >= 40) return "C";
  if (percentage >= 33) return "D";
  return "E";
};

const getDivisionFromPercentage = (percentage: number) => {
  if (percentage >= 60) return "First Division";
  if (percentage >= 45) return "Second Division";
  if (percentage >= 33) return "Third Division";
  return "Fail";
};

const EXAM_TYPE_ACRONYM: Record<ExamType, string> = {
  quarterly: "QTR",
  half_yearly: "HY",
  annual: "ANL",
};

const COMPONENT_ACRONYM: Record<ResultComponent, string> = {
  assignment_1: "AS1",
  internal_1: "INT1",
  quarterly: "QTR",
  assignment_2: "AS2",
  internal_2: "INT2",
  half_yearly: "HY",
  theory: "TH",
  practical_assignment: "PR",
};

const sanitizeFilePart = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);

const getImageExtension = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) return extension;
  return "";
};

const getResultLogoUrl = async () => {
  try {
    const files = await readdir(resultsLogoDir, { withFileTypes: true });
    const logoNames = files
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));

    if (!logoNames.length) return null;
    return `/api/upload/results-logo/${logoNames[0]}`;
  } catch {
    return null;
  }
};

const findStudentByUserId = async (userId: string) => {
  const rows = await db
    .select({
      studentId: studentsTable.id,
      rollNumber: studentsTable.rollNumber,
      enrollmentNo: studentsTable.enrollmentNo,
      fathersName: studentsTable.fathersName,
      mothersName: studentsTable.mothersName,
      dateOfBirth: studentsTable.dateOfBirth,
      category: studentsTable.category,
      className: classesTable.name,
      sessionName: academicSessionsTable.name,
      userId: usersTable.id,
      fullName: usersTable.fullName,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .innerJoin(
      academicSessionsTable,
      eq(studentsTable.sessionId, academicSessionsTable.id),
    )
    .where(eq(studentsTable.userId, userId))
    .limit(1);

  return rows[0] ?? null;
};

const findStudentByStudentId = async (studentId: string) => {
  const rows = await db
    .select({
      studentId: studentsTable.id,
      rollNumber: studentsTable.rollNumber,
      enrollmentNo: studentsTable.enrollmentNo,
      fathersName: studentsTable.fathersName,
      mothersName: studentsTable.mothersName,
      dateOfBirth: studentsTable.dateOfBirth,
      category: studentsTable.category,
      className: classesTable.name,
      sessionName: academicSessionsTable.name,
      userId: usersTable.id,
      fullName: usersTable.fullName,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .innerJoin(
      academicSessionsTable,
      eq(studentsTable.sessionId, academicSessionsTable.id),
    )
    .where(eq(studentsTable.id, studentId))
    .limit(1);

  return rows[0] ?? null;
};

const getStudentExamResults = async (
  studentId: string,
  examId?: string,
): Promise<ExamResultItem[]> => {
  const rows = await db
    .select({
      examId: examsTable.id,
      examName: examsTable.name,
      examType: examsTable.examType,
      academicYear: examsTable.academicYear,
      startDate: examsTable.startDate,
      endDate: examsTable.endDate,
      className: classesTable.name,
      sessionName: academicSessionsTable.name,
      examSubjectId: examSubjectsTable.id,
      subjectId: subjectsTable.id,
      subjectName: subjectsTable.name,
      subjectCode: subjectsTable.code,
      component: examSubjectComponentsTable.component,
      componentMaxMarks: examSubjectComponentsTable.maxMarks,
      componentPassMarks: examSubjectComponentsTable.passMarks,
      obtainedMarks: studentMarksTable.obtainedMarks,
    })
    .from(studentExamEnrollmentsTable)
    .innerJoin(
      examsTable,
      eq(studentExamEnrollmentsTable.examId, examsTable.id),
    )
    .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
    .innerJoin(
      academicSessionsTable,
      eq(examsTable.sessionId, academicSessionsTable.id),
    )
    .innerJoin(
      examSubjectsTable,
      eq(examSubjectsTable.examId, studentExamEnrollmentsTable.examId),
    )
    .innerJoin(subjectsTable, eq(examSubjectsTable.subjectId, subjectsTable.id))
    .innerJoin(
      examSubjectComponentsTable,
      eq(examSubjectComponentsTable.examSubjectId, examSubjectsTable.id),
    )
    .leftJoin(
      studentMarksTable,
      and(
        eq(studentMarksTable.studentId, studentExamEnrollmentsTable.studentId),
        eq(studentMarksTable.examSubjectId, examSubjectsTable.id),
        eq(studentMarksTable.component, examSubjectComponentsTable.component),
      ),
    )
    .where(
      and(
        eq(studentExamEnrollmentsTable.studentId, studentId),
        examId ? eq(studentExamEnrollmentsTable.examId, examId) : undefined,
      ),
    )
    .orderBy(
      asc(examsTable.startDate),
      asc(subjectsTable.name),
      asc(examSubjectComponentsTable.component),
    );

  const examMap = new Map<string, ExamResultItem>();

  for (const row of rows) {
    if (!examMap.has(row.examId)) {
      examMap.set(row.examId, {
        examId: row.examId,
        examName: row.examName,
        examType: row.examType,
        examTypeLabel: EXAM_TYPE_LABELS[row.examType],
        academicYear: row.academicYear,
        className: row.className,
        sessionName: row.sessionName,
        startDate: row.startDate,
        endDate: row.endDate,
        totalObtained: 0,
        totalMax: 0,
        totalPass: 0,
        percentage: 0,
        grade: "E",
        division: "Fail",
        status: "pending",
        subjects: [],
      });
    }

    const exam = examMap.get(row.examId)!;
    let subject = exam.subjects.find((item) => item.examSubjectId === row.examSubjectId);

    if (!subject) {
      subject = {
        examSubjectId: row.examSubjectId,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        subjectCode: row.subjectCode,
        components: [],
        totalObtained: 0,
        totalMax: 0,
        totalPass: 0,
        status: "pending",
      };
      exam.subjects.push(subject);
    }

    const componentStatus =
      row.obtainedMarks === null
        ? ("pending" as const)
        : row.obtainedMarks >= row.componentPassMarks
          ? ("pass" as const)
          : ("fail" as const);

    subject.components.push({
      component: row.component,
      componentLabel:
        COMPONENT_LABELS[row.component as keyof typeof COMPONENT_LABELS] ?? row.component,
      maxMarks: row.componentMaxMarks,
      passMarks: row.componentPassMarks,
      obtainedMarks: row.obtainedMarks,
      status: componentStatus,
    });

    subject.totalMax += row.componentMaxMarks;
    subject.totalPass += row.componentPassMarks;
    if (row.obtainedMarks !== null) subject.totalObtained += row.obtainedMarks;
  }

  return Array.from(examMap.values()).map((exam) => {
    exam.subjects = exam.subjects.map((subject) => {
      const hasPending = subject.components.some((item) => item.status === "pending");
      const status = hasPending
        ? ("pending" as const)
        : subject.totalObtained >= subject.totalPass
          ? ("pass" as const)
          : ("fail" as const);
      return { ...subject, status };
    });

    exam.totalObtained = exam.subjects.reduce((sum, item) => sum + item.totalObtained, 0);
    exam.totalMax = exam.subjects.reduce((sum, item) => sum + item.totalMax, 0);
    exam.totalPass = exam.subjects.reduce((sum, item) => sum + item.totalPass, 0);

    const hasPending = exam.subjects.some((item) => item.status === "pending");
    const percentage =
      !hasPending && exam.totalMax > 0 ? (exam.totalObtained / exam.totalMax) * 100 : 0;
    const hasFail = exam.subjects.some((item) => item.status === "fail");

    return {
      ...exam,
      percentage: round2(percentage),
      grade: hasPending ? "NA" : getGradeFromPercentage(percentage),
      division: hasPending ? "Pending" : getDivisionFromPercentage(percentage),
      status: hasPending ? "pending" : hasFail ? "fail" : "pass",
    };
  });
};

const drawWatermark = async (doc: PDFDocument, text: string) => {
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    for (let y = -height; y < height * 1.8; y += 120) {
      for (let x = -width; x < width * 1.8; x += 260) {
        page.drawText(text, {
          x,
          y,
          size: 18,
          font,
          color: rgb(0.75, 0.75, 0.75),
          rotate: degrees(-35),
          opacity: 0.26,
        });
      }
    }
  }
};

const generateStudentCopyPdf = async (
  student: Awaited<ReturnType<typeof findStudentByUserId>>,
  result: ExamResultItem,
) => {
  const doc = await PDFDocument.create();
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
  });

  let cursorY = height - 60;
  page.drawText("STUDENT RESULT COPY", {
    x: 40,
    y: cursorY,
    size: 18,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08),
  });

  cursorY -= 24;
  page.drawText("For personal reference only. Not an official marksheet.", {
    x: 40,
    y: cursorY,
    size: 10,
    font: regularFont,
    color: rgb(0.35, 0.35, 0.35),
  });

  cursorY -= 28;
  page.drawText(`Student: ${student?.fullName ?? "-"}`, {
    x: 40,
    y: cursorY,
    size: 11,
    font: boldFont,
  });
  cursorY -= 16;
  page.drawText(
    `Roll No: ${student?.rollNumber ?? "-"} | Enrollment No: ${student?.enrollmentNo ?? "-"} | Class: ${result.className}`,
    {
    x: 40,
    y: cursorY,
    size: 11,
    font: regularFont,
    },
  );
  cursorY -= 16;
  page.drawText(
    `Exam: ${result.examName} (${result.examTypeLabel}) - ${result.academicYear}`,
    {
      x: 40,
      y: cursorY,
      size: 11,
      font: regularFont,
    },
  );

  cursorY -= 26;
  page.drawText("Subject/Component", { x: 42, y: cursorY, size: 10, font: boldFont });
  page.drawText("Obt", { x: 315, y: cursorY, size: 10, font: boldFont });
  page.drawText("Max", { x: 360, y: cursorY, size: 10, font: boldFont });
  page.drawText("Pass", { x: 405, y: cursorY, size: 10, font: boldFont });
  page.drawText("Status", { x: 455, y: cursorY, size: 10, font: boldFont });

  cursorY -= 8;
  page.drawLine({ start: { x: 40, y: cursorY }, end: { x: width - 40, y: cursorY }, thickness: 0.8 });

  for (const subject of result.subjects) {
    cursorY -= 16;
    page.drawText(`${subject.subjectName} (${subject.subjectCode})`, {
      x: 42,
      y: cursorY,
      size: 10,
      font: boldFont,
    });

    for (const component of subject.components) {
      cursorY -= 14;
      page.drawText(`  - ${component.componentLabel}`, {
        x: 42,
        y: cursorY,
        size: 9,
        font: regularFont,
      });
      page.drawText(component.obtainedMarks === null ? "-" : String(component.obtainedMarks), {
        x: 315,
        y: cursorY,
        size: 9,
        font: regularFont,
      });
      page.drawText(String(component.maxMarks), {
        x: 360,
        y: cursorY,
        size: 9,
        font: regularFont,
      });
      page.drawText(String(component.passMarks), {
        x: 405,
        y: cursorY,
        size: 9,
        font: regularFont,
      });
      page.drawText(component.status.toUpperCase(), {
        x: 455,
        y: cursorY,
        size: 9,
        font: regularFont,
      });
    }

    cursorY -= 14;
    page.drawText(
      `  Subject Total: ${subject.totalObtained}/${subject.totalMax} (Pass ${subject.totalPass})`,
      {
        x: 42,
        y: cursorY,
        size: 9,
        font: boldFont,
      },
    );
  }

  cursorY -= 20;
  page.drawLine({ start: { x: 40, y: cursorY }, end: { x: width - 40, y: cursorY }, thickness: 1 });
  cursorY -= 20;

  page.drawText(`Grand Total: ${result.totalObtained}/${result.totalMax} | Pass: ${result.totalPass}`, {
    x: 40,
    y: cursorY,
    size: 11,
    font: boldFont,
  });
  cursorY -= 16;
  page.drawText(
    `Percentage: ${result.percentage.toFixed(2)}% | Grade: ${result.grade} | Division: ${result.division} | Result: ${result.status.toUpperCase()}`,
    {
      x: 40,
      y: cursorY,
      size: 10,
      font: regularFont,
    },
  );

  await drawWatermark(doc, "STUDENT COPY - NOT OFFICIAL");
  return doc.save();
};

const numberToWords = (num: number) => {
  const n = Math.floor(num);
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n === 0) return "zero";

  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  const belowThousand = (value: number) => {
    const hundred = Math.floor(value / 100);
    const rem = value % 100;
    const hundredPart = hundred ? `${ones[hundred]} hundred` : "";
    const remPart =
      rem === 0 ? "" : rem < 20 ? ones[rem] : `${tens[Math.floor(rem / 10)]}${rem % 10 ? ` ${ones[rem % 10]}` : ""}`;
    return [hundredPart, remPart].filter(Boolean).join(" ");
  };

  const parts: string[] = [];
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  if (billions) parts.push(`${belowThousand(billions)} billion`);
  if (millions) parts.push(`${belowThousand(millions)} million`);
  if (thousands) parts.push(`${belowThousand(thousands)} thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
};

const generateOfficialResultPdf = async (data: OfficialMarksheetData) => {
  const doc = await PDFDocument.create();
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]);
  const { width } = page.getSize();

  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: 785,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
  });

  let cursorY = 800;
  page.drawText(data.header.examinationTitle, {
    x: 40,
    y: cursorY,
    size: 13,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08),
  });

  cursorY -= 18;
  page.drawText(
    `Certificate: ${data.header.certificateNumber} | Roll: ${data.header.rollNumber} | Enrollment: ${data.header.enrollmentNo}`,
    {
    x: 40,
    y: cursorY,
    size: 9,
    font: regularFont,
    },
  );

  cursorY -= 20;
  page.drawText(`Student: ${data.student.fullName}`, {
    x: 40,
    y: cursorY,
    size: 10,
    font: boldFont,
  });
  cursorY -= 13;
  page.drawText(`Father: ${data.student.fathersName} | Mother: ${data.student.mothersName}`, {
    x: 40,
    y: cursorY,
    size: 9,
    font: regularFont,
  });
  cursorY -= 13;
  page.drawText(
    `Class: ${data.student.className} | Category: ${data.student.category} | Exam: ${data.exam.examTypeLabel}`,
    {
      x: 40,
      y: cursorY,
      size: 9,
      font: regularFont,
    },
  );

  cursorY -= 18;
  const left = 40;
  const tableWidth = width - 80;
  const columns = [
    { key: "sno", label: "S.NO", width: 26 },
    { key: "subject", label: "SUBJECT", width: 130 },
    { key: "max", label: "MAX", width: 28 },
    { key: "min", label: "MIN", width: 28 },
    ...data.componentColumns.map((col) => ({
      key: `comp-${col.component}`,
      label: COMPONENT_ACRONYM[col.component],
      width: 24,
    })),
    ...data.statementColumns.map((col) => ({
      key: `exam-${col.examType}`,
      label: EXAM_TYPE_ACRONYM[col.examType],
      width: 26,
    })),
    { key: "total", label: "TOTAL", width: 34 },
  ];
  const rawWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scale = tableWidth / rawWidth;
  const widths = columns.map((col) => Math.max(18, col.width * scale));

  let x = left;
  const rowHeight = 13;
  for (let i = 0; i < columns.length; i += 1) {
    const w = widths[i];
    page.drawRectangle({ x, y: cursorY - rowHeight + 2, width: w, height: rowHeight, borderWidth: 0.6, borderColor: rgb(0, 0, 0) });
    page.drawText(columns[i].label, { x: x + 2, y: cursorY - 8, size: 7.5, font: boldFont });
    x += w;
  }
  cursorY -= rowHeight;

  for (let i = 0; i < data.marks.length; i += 1) {
    const row = data.marks[i];
    x = left;
    const values = [
      String(i + 1),
      row.subjectName,
      String(row.schemeMax),
      String(row.schemeMin),
      ...data.componentColumns.map((col) => {
        const val = row.componentMarks[col.component];
        return val === null || val === undefined ? "-" : String(val);
      }),
      ...data.statementColumns.map((col) => {
        const val = row.marksByType[col.examType];
        return val === null || val === undefined ? "-" : String(val);
      }),
      String(row.total),
    ];
    for (let colIdx = 0; colIdx < widths.length; colIdx += 1) {
      const w = widths[colIdx];
      page.drawRectangle({ x, y: cursorY - rowHeight + 2, width: w, height: rowHeight, borderWidth: 0.45, borderColor: rgb(0, 0, 0) });
      const isSubjectCol = colIdx === 1;
      const text = values[colIdx] ?? "";
      page.drawText(text.length > (isSubjectCol ? 22 : 10) ? `${text.slice(0, isSubjectCol ? 22 : 10)}.` : text, {
        x: x + 2,
        y: cursorY - 8,
        size: 7.2,
        font: regularFont,
      });
      x += w;
    }
    cursorY -= rowHeight;
    if (cursorY < 210) break;
  }

  page.drawText(
    `Grand Total: ${data.summary.totalMarks}/${data.summary.totalMax} | Percentage: ${data.summary.percentage.toFixed(2)}% | Grade: ${data.summary.grade}`,
    { x: 40, y: cursorY - 14, size: 9, font: boldFont },
  );
  page.drawText(
    `Division: ${data.summary.division} | Result: ${data.summary.status.toUpperCase()}`,
    { x: 40, y: cursorY - 27, size: 9, font: regularFont },
  );
  page.drawText(
    `In Words: ${numberToWords(data.summary.totalMarks).toUpperCase()}`,
    { x: 40, y: cursorY - 40, size: 8.5, font: regularFont },
  );
  page.drawText("Authorized Signature", { x: width - 160, y: cursorY - 62, size: 9, font: regularFont });
  page.drawLine({ start: { x: width - 175, y: cursorY - 48 }, end: { x: width - 60, y: cursorY - 48 }, thickness: 0.7 });

  return doc.save();
};

const buildOfficialMarksheetData = async (
  studentId: string,
  examId: string,
): Promise<OfficialMarksheetData> => {
  const student = await findStudentByStudentId(studentId);
  if (!student) {
    throw new Error("Student not found");
  }

  const allExamResults = await getStudentExamResults(studentId);
  const examResult = allExamResults.find((result) => result.examId === examId);
  if (!examResult) {
    throw new Error("No result found for selected student and exam");
  }
  if (examResult.status === "pending") {
    throw new Error("Official marksheet cannot be generated until all marks are entered");
  }

  const includedTypes = getIncludedExamTypes(examResult.examType);
  const includedComponents = includedTypes.flatMap((examType) =>
    getComponentsForExamType(examType),
  );
  const relatedExamResults = allExamResults.filter(
    (result) =>
      result.className === examResult.className &&
      result.sessionName === examResult.sessionName &&
      result.academicYear === examResult.academicYear,
  );

  const selectedStart = examResult.startDate ? new Date(examResult.startDate).getTime() : null;
  const examByType = new Map<ExamType, ExamResultItem>();

  for (const examType of includedTypes) {
    if (examType === examResult.examType) {
      examByType.set(examType, examResult);
      continue;
    }

    const candidates = relatedExamResults
      .filter((result) => result.examType === examType)
      .sort((a, b) => {
        const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
        return bDate - aDate;
      });

    const eligibleByDate = candidates.filter((result) => {
      if (!selectedStart || !result.startDate) return true;
      return new Date(result.startDate).getTime() <= selectedStart;
    });

    const matched =
      eligibleByDate.find((result) => result.status !== "pending") ??
      eligibleByDate[0] ??
      candidates.find((result) => result.status !== "pending") ??
      candidates[0];

    if (matched) {
      examByType.set(examType, matched);
    }
  }

  const subjectMap = new Map<
    string,
    {
      subjectId: string;
      subjectName: string;
      subjectCode: string;
      schemeMax: number;
      schemeMin: number;
      componentMarks: Partial<Record<ResultComponent, number | null>>;
      marksByType: Partial<Record<ExamType, number | null>>;
      total: number;
    }
  >();

  const totalsByComponent = includedComponents.reduce(
    (acc, component) => {
      acc[component] = 0;
      return acc;
    },
    {} as Record<ResultComponent, number>,
  );

  for (const examType of includedTypes) {
    const result = examByType.get(examType);
    if (!result) continue;

    for (const subject of result.subjects) {
      // Merge subjects by stable identity so marks remain aligned even if subject IDs
      // differ between exams due to recreated subject records.
      const normalizedCode = subject.subjectCode.trim().toUpperCase();
      const normalizedName = subject.subjectName.trim().toUpperCase();
      const key = normalizedCode ? `code:${normalizedCode}` : `name:${normalizedName}`;
      const existing = subjectMap.get(key) ?? {
        subjectId: key,
        subjectName: subject.subjectName,
        subjectCode: subject.subjectCode,
        schemeMax: subject.totalMax,
        schemeMin: subject.totalPass,
        componentMarks: {},
        marksByType: {},
        total: 0,
      };

      existing.subjectName = subject.subjectName;
      existing.subjectCode = subject.subjectCode;
      existing.schemeMax = Math.max(existing.schemeMax, subject.totalMax);
      existing.schemeMin = Math.max(existing.schemeMin, subject.totalPass);
      existing.marksByType[examType] = subject.status === "pending" ? null : subject.totalObtained;
      if (subject.status !== "pending") existing.total += subject.totalObtained;
      for (const component of subject.components) {
        const componentKey = component.component as ResultComponent;
        existing.componentMarks[componentKey] = component.obtainedMarks;
        if (component.obtainedMarks !== null) {
          totalsByComponent[componentKey] =
            (totalsByComponent[componentKey] ?? 0) + component.obtainedMarks;
        }
      }

      subjectMap.set(key, existing);
    }
  }

  const includedExamSummaries = includedTypes.map((examType) => {
    const result = examByType.get(examType);
    return {
      examType,
      examTypeLabel: EXAM_TYPE_LABELS[examType],
      examId: result?.examId ?? null,
      examName: result?.examName ?? null,
      totalMarks: result?.totalObtained ?? 0,
      totalMax: result?.totalMax ?? 0,
      percentage: result?.percentage ?? 0,
      grade: result?.grade ?? "NA",
      status: result?.status ?? "pending",
      hasData: Boolean(result),
    };
  });

  const marks = Array.from(subjectMap.values()).sort((a, b) =>
    a.subjectName.localeCompare(b.subjectName),
  );

  const totalByType = includedTypes.reduce(
    (acc, examType) => {
      const result = examByType.get(examType);
      acc[examType] = {
        obtained: result?.totalObtained ?? 0,
        max: result?.totalMax ?? 0,
      };
      return acc;
    },
    {} as Record<ExamType, { obtained: number; max: number }>,
  );

  const grandTotalObtained = includedExamSummaries.reduce(
    (sum, exam) => sum + exam.totalMarks,
    0,
  );
  const grandTotalMax = includedExamSummaries.reduce((sum, exam) => sum + exam.totalMax, 0);
  const summaryPercentage = grandTotalMax > 0 ? round2((grandTotalObtained / grandTotalMax) * 100) : 0;
  const summaryGrade = getGradeFromPercentage(summaryPercentage);
  const summaryDivision = getDivisionFromPercentage(summaryPercentage);
  const hasFailedIncludedExam = includedExamSummaries.some((exam) => exam.status === "fail");
  const hasPendingIncludedExam = includedExamSummaries.some((exam) => !exam.hasData || exam.status === "pending");

  const studentIdentifier =
    (student.enrollmentNo ?? student.rollNumber ?? student.studentId).replace(
      /[^a-zA-Z0-9_-]/g,
      "",
    ) || "NA";
  const certificateNumber = `${new Date().getFullYear()}-${studentIdentifier}-${examResult.examId.slice(0, 6).toUpperCase()}`;
  const logoUrl = await getResultLogoUrl();

  return {
    header: {
      boardName: "School Examination Board",
      examinationTitle: `${examResult.examTypeLabel} Result - ${examResult.academicYear}`,
      certificateTitle: "Official Marksheet",
      certificateNumber,
      rollNumber: student.rollNumber ?? "-",
      enrollmentNo: student.enrollmentNo ?? "-",
      logoUrl,
    },
    student: {
      studentId: student.studentId,
      fullName: student.fullName,
      avatarUrl: student.avatarUrl,
      fathersName: student.fathersName,
      mothersName: student.mothersName,
      dateOfBirth: student.dateOfBirth,
      category: student.category,
      className: examResult.className,
      schoolName: "School Name Placeholder",
      examCenter: "Exam Center Placeholder",
    },
    exam: {
      examId: examResult.examId,
      examName: examResult.examName,
      examType: examResult.examType,
      examTypeLabel: examResult.examTypeLabel,
      sessionName: examResult.sessionName,
      academicYear: examResult.academicYear,
      startDate: examResult.startDate,
      endDate: examResult.endDate,
    },
    statementColumns: includedTypes.map((examType) => ({
      examType,
      label: EXAM_TYPE_LABELS[examType],
    })),
    componentColumns: includedComponents.map((component) => ({
      component,
      label: COMPONENT_LABELS[component],
    })),
    marks,
    totalsByComponent,
    totalsByExamType: totalByType,
    examSummaries: includedExamSummaries,
    summary: {
      totalMarks: grandTotalObtained,
      totalMax: grandTotalMax,
      totalPass: 0,
      percentage: summaryPercentage,
      division: summaryDivision,
      grade: summaryGrade,
      status: hasPendingIncludedExam ? "pending" : hasFailedIncludedExam ? "fail" : "pass",
    },
  };
};

resultsRouter.get(
  "/logo",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    try {
      const logoUrl = await getResultLogoUrl();
      return c.json<SuccessResponse<{ logoUrl: string | null }>>({
        success: true,
        message: "Result logo retrieved successfully",
        data: { logoUrl },
      });
    } catch (err) {
      console.error("Error retrieving result logo:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve result logo" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.post(
  "/logo",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const body = await c.req.parseBody({ all: true });
      const file =
        body.logo instanceof File
          ? body.logo
          : body.file instanceof File
            ? body.file
            : null;

      if (!file || !file.name || file.size === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Logo file is required" },
          HttpStatus.BadRequest,
        );
      }

      const extension = getImageExtension(file.name);
      if (!extension) {
        return c.json<ErrorResponse>(
          { success: false, error: "Only jpg, jpeg, png, and webp images are allowed" },
          HttpStatus.BadRequest,
        );
      }

      await mkdir(resultsLogoDir, { recursive: true });

      const existingFiles = await readdir(resultsLogoDir, { withFileTypes: true });
      for (const entry of existingFiles) {
        if (!entry.isFile()) continue;
        try {
          await unlink(path.join(resultsLogoDir, entry.name));
        } catch {
          // Best-effort cleanup. Continue with upload.
        }
      }

      const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
      const finalPath = path.join(resultsLogoDir, savedFileName);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      await Bun.write(finalPath, fileBuffer);

      const logoUrl = `/api/upload/results-logo/${savedFileName}`;

      return c.json<SuccessResponse<{ logoUrl: string }>>({
        success: true,
        message: "Result logo uploaded successfully",
        data: { logoUrl },
      });
    } catch (err) {
      console.error("Error uploading result logo:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to upload result logo" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.get(
  "/admit-card-control/:examId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("param", examParamSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid exam id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    try {
      const { examId } = c.req.valid("param");
      const result = await getExamAdmitCardStudentStatuses(examId);

      if (!result) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found" },
          HttpStatus.NotFound,
        );
      }

      const paidCount = result.students.filter((student) => student.fullyPaid).length;

      return c.json<SuccessResponse>({
        success: true,
        message: "Admit card control data retrieved successfully",
        data: {
          exam: {
            id: result.context.examId,
            name: result.context.examName,
            examType: result.context.examType,
            academicYear: result.context.academicYear,
            classId: result.context.classId,
            className: result.context.className,
            sessionId: result.context.sessionId,
            sessionName: result.context.sessionName,
          },
          control: {
            mode: result.context.mode,
            newStudentAmount: result.context.newStudentAmount,
            oldStudentAmount: result.context.oldStudentAmount,
            defaultNewStudentAmount: result.context.defaultNewAmount,
            defaultOldStudentAmount: result.context.defaultOldAmount,
            startMonth: result.context.startMonth,
            startYear: result.context.startYear,
            endMonth: result.context.endMonth,
            endYear: result.context.endYear,
            updatedAt: result.context.updatedAt,
          },
          summary: {
            totalStudents: result.students.length,
            paidStudents: paidCount,
            unpaidStudents: result.students.length - paidCount,
          },
          students: result.students,
        },
      });
    } catch (err) {
      console.error("Error retrieving admit card control data:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve admit card control data" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.put(
  "/admit-card-control/:examId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("param", examParamSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid exam id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  zValidator("json", admitCardControlUpdateSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid admit card control payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    try {
      const { examId } = c.req.valid("param");
      const body = c.req.valid("json");
      const user = c.get("user") as { id: string };

      const exam = await db
        .select({ id: examsTable.id })
        .from(examsTable)
        .where(eq(examsTable.id, examId))
        .limit(1);

      if (!exam.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found" },
          HttpStatus.NotFound,
        );
      }

      await db
        .insert(examAdmitCardControlsTable)
        .values({
          examId,
          mode: body.mode,
          newStudentAmount: body.newStudentAmount,
          oldStudentAmount: body.oldStudentAmount,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .onConflictDoUpdate({
          target: [examAdmitCardControlsTable.examId],
          set: {
            mode: body.mode,
            newStudentAmount: body.newStudentAmount,
            oldStudentAmount: body.oldStudentAmount,
            updatedBy: user.id,
            updatedAt: new Date(),
          },
        });

      return c.json<SuccessResponse>({
        success: true,
        message: "Admit card control settings saved successfully",
      });
    } catch (err) {
      console.error("Error saving admit card control settings:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to save admit card control settings" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.get(
  "/result-control/:examId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("param", examParamSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid exam id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    try {
      const { examId } = c.req.valid("param");
      const result = await getExamAdmitCardStudentStatuses(examId);

      if (!result) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found" },
          HttpStatus.NotFound,
        );
      }

      const paidCount = result.students.filter((student) => student.fullyPaid).length;

      return c.json<SuccessResponse>({
        success: true,
        message: "Result control data retrieved successfully",
        data: {
          exam: {
            id: result.context.examId,
            name: result.context.examName,
            examType: result.context.examType,
            academicYear: result.context.academicYear,
            classId: result.context.classId,
            className: result.context.className,
            sessionId: result.context.sessionId,
            sessionName: result.context.sessionName,
          },
          control: {
            mode: result.context.resultMode,
            newStudentAmount: Math.max(
              result.context.newStudentAmount,
              result.context.defaultNewAmount ?? 0,
            ),
            oldStudentAmount: Math.max(
              result.context.oldStudentAmount,
              result.context.defaultOldAmount ?? 0,
            ),
            defaultNewStudentAmount: result.context.defaultNewAmount,
            defaultOldStudentAmount: result.context.defaultOldAmount,
            startMonth: result.context.startMonth,
            startYear: result.context.startYear,
            endMonth: result.context.endMonth,
            endYear: result.context.endYear,
            updatedAt: result.context.updatedAt,
          },
          summary: {
            totalStudents: result.students.length,
            paidStudents: paidCount,
            unpaidStudents: result.students.length - paidCount,
          },
          students: result.students,
        },
      });
    } catch (err) {
      console.error("Error retrieving result control data:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve result control data" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.put(
  "/result-control/:examId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("param", examParamSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid exam id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  zValidator("json", resultControlUpdateSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid result control payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    try {
      const { examId } = c.req.valid("param");
      const body = c.req.valid("json");
      const user = c.get("user") as { id: string };
      const context = await getExamAdmitCardControlContext(examId);

      const exam = await db
        .select({ id: examsTable.id })
        .from(examsTable)
        .where(eq(examsTable.id, examId))
        .limit(1);

      if (!exam.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found" },
          HttpStatus.NotFound,
        );
      }

      await db
        .insert(examAdmitCardControlsTable)
        .values({
          examId,
          mode: "off",
          resultMode: body.resultMode,
          newStudentAmount: Math.max(context?.newStudentAmount ?? 0, context?.defaultNewAmount ?? 0),
          oldStudentAmount: Math.max(context?.oldStudentAmount ?? 0, context?.defaultOldAmount ?? 0),
          createdBy: user.id,
          updatedBy: user.id,
        })
        .onConflictDoUpdate({
          target: [examAdmitCardControlsTable.examId],
          set: {
            resultMode: body.resultMode,
            updatedBy: user.id,
            updatedAt: new Date(),
          },
        });

      return c.json<SuccessResponse>({
        success: true,
        message: "Result control settings saved successfully",
      });
    } catch (err) {
      console.error("Error saving result control settings:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to save result control settings" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.get(
  "/my-results",
  requireAuth,
  requireRoles([Role.STUDENT]),
  async (c) => {
    try {
      const user = (c as any).get("user") as { id: string };
      const student = await findStudentByUserId(user.id);

      if (!student) {
        return c.json<ErrorResponse>(
          { success: false, error: "Student profile not found" },
          HttpStatus.NotFound,
        );
      }

      const results = await getStudentExamResults(student.studentId);
      const accessibleResults = [];

      for (const exam of results) {
        const access = await evaluateStudentResultAccess(exam.examId, student.studentId);
        if (!access?.allowed) continue;
        accessibleResults.push(exam);
      }

      return c.json<SuccessResponse>({
        success: true,
        message: "Student results retrieved successfully",
        data: {
          student,
          exams: accessibleResults,
        },
      });
    } catch (err) {
      console.error("Error retrieving student results:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve student results" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.get(
  "/admit-card/:examId",
  requireAuth,
  requireRoles([Role.ADMIN, Role.STUDENT]),
  zValidator("param", examParamSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid exam id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  zValidator("query", admitCardQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid student id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    try {
      const { examId } = c.req.valid("param");
      const { studentId } = c.req.valid("query");
      const user = c.get("user") as { id: string };
      const userRoles = (c.get("userRole") as string[]) ?? [];

      let targetStudentId = studentId ?? null;

      if (userRoles.includes(Role.STUDENT)) {
        const selfStudent = await findStudentByUserId(user.id);
        if (!selfStudent) {
          return c.json<ErrorResponse>(
            { success: false, error: "Student profile not found" },
            HttpStatus.NotFound,
          );
        }
        targetStudentId = selfStudent.studentId;
      }

      if (!targetStudentId) {
        const firstEnrollment = await db
          .select({ studentId: studentExamEnrollmentsTable.studentId })
          .from(studentExamEnrollmentsTable)
          .where(eq(studentExamEnrollmentsTable.examId, examId))
          .orderBy(asc(studentExamEnrollmentsTable.createdAt))
          .limit(1);

        if (!firstEnrollment.length) {
          return c.json<ErrorResponse>(
            { success: false, error: "No students enrolled for this exam" },
            HttpStatus.NotFound,
          );
        }

        targetStudentId = firstEnrollment[0].studentId;
      }

      if (!targetStudentId) {
        return c.json<ErrorResponse>(
          { success: false, error: "Student not found for admit card generation" },
          HttpStatus.NotFound,
        );
      }

      const isStudentUser = userRoles.includes(Role.STUDENT);
      if (isStudentUser) {
        const access = await evaluateStudentAdmitCardAccess(examId, targetStudentId);

        if (!access) {
          return c.json<ErrorResponse>(
            { success: false, error: "Admit card access data not found for this student" },
            HttpStatus.NotFound,
          );
        }

        if (!access.allowed) {
          return c.json<ErrorResponse>(
            {
              success: false,
              error: access.reason ?? "Admit card access is blocked for this student",
            },
            HttpStatus.Forbidden,
          );
        }
      }

      const rows = await db
        .select({
          examId: examsTable.id,
          examName: examsTable.name,
          examType: examsTable.examType,
          academicYear: examsTable.academicYear,
          startDate: examsTable.startDate,
          endDate: examsTable.endDate,
          className: classesTable.name,
          sessionName: academicSessionsTable.name,
          studentId: studentsTable.id,
          rollNumber: studentsTable.rollNumber,
          enrollmentNo: studentsTable.enrollmentNo,
          fathersName: studentsTable.fathersName,
          mothersName: studentsTable.mothersName,
            dateOfBirth: studentsTable.dateOfBirth,
            gender: studentsTable.gender,
            category: studentsTable.category,
            address: studentsTable.address,
            mobileNo: studentsTable.mobileNo,
            fullName: usersTable.fullName,
            avatarUrl: usersTable.avatarUrl,
          })
        .from(studentExamEnrollmentsTable)
        .innerJoin(
          examsTable,
          eq(studentExamEnrollmentsTable.examId, examsTable.id),
        )
        .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
        .innerJoin(
          academicSessionsTable,
          eq(examsTable.sessionId, academicSessionsTable.id),
        )
        .innerJoin(
          studentsTable,
          eq(studentExamEnrollmentsTable.studentId, studentsTable.id),
        )
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .where(
          and(
            eq(studentExamEnrollmentsTable.examId, examId),
            eq(studentExamEnrollmentsTable.studentId, targetStudentId),
          ),
        )
        .limit(1);

      if (!rows.length) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error: "Admit card not found for selected student and exam",
          },
          HttpStatus.NotFound,
        );
      }

      const scheduleRows = await db
        .select({
          subjectId: subjectsTable.id,
          subjectName: subjectsTable.name,
          subjectCode: subjectsTable.code,
          examDate: examSubjectsTable.examDate,
          startTime: examSubjectsTable.startTime,
          endTime: examSubjectsTable.endTime,
        })
        .from(examSubjectsTable)
        .innerJoin(subjectsTable, eq(examSubjectsTable.subjectId, subjectsTable.id))
        .where(eq(examSubjectsTable.examId, examId))
        .orderBy(asc(examSubjectsTable.examDate), asc(subjectsTable.name));

      const logoUrl = await getResultLogoUrl();
      const summary = rows[0];
      const defaultTiming = formatTimeLabel(summary.startDate) ?? "09:00 AM";

      const timetable = scheduleRows.map((item) => {
        const effectiveDate = item.examDate ?? summary.startDate ?? summary.endDate;
        const startTimeLabel = formatTimeLabel(item.startTime);
        const endTimeLabel = formatTimeLabel(item.endTime);
        return {
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          subjectCode: item.subjectCode,
          dateOfExam: formatDateLabel(effectiveDate),
          dayOfExam: formatDayLabel(effectiveDate),
          timing:
            startTimeLabel && endTimeLabel
              ? `${startTimeLabel} - ${endTimeLabel}`
              : formatTimeLabel(effectiveDate) ?? defaultTiming,
        };
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Admit card data retrieved successfully",
        data: {
            school: {
              name: "H.B.R. ENGLISH MEDIUM SCHOOL BILHA",
              district: "DIST-BILASPUR (C.G.)",
              affiliation: "Affiliated to: C.G. BOARD RAIPUR (312278)",
              udiseNo: "UDISE NO. : 22070321207",
              address:
                "Office Address - Near Main Hospital, Ward No. 01, Bilha Bilaspur (C.G.)",
              phone: "Phone - 7024508350",
              email: "Email - hbrschoolbilha@gmail.com",
              logoUrl,
            },
            student: {
              studentId: summary.studentId,
              fullName: summary.fullName,
              fathersName: summary.fathersName,
              mothersName: summary.mothersName,
              dateOfBirth: summary.dateOfBirth,
              className: summary.className,
              gender: summary.gender,
              category: summary.category,
              address: summary.address,
              mobileNo: summary.mobileNo,
              rollNumber: summary.rollNumber,
              enrollmentNo: summary.enrollmentNo,
              avatarUrl: summary.avatarUrl,
            },
          exam: {
            examId: summary.examId,
            examName: summary.examName,
            examType: summary.examType,
            examTypeLabel: EXAM_TYPE_LABELS[summary.examType],
            academicYear: summary.academicYear,
            sessionName: summary.sessionName,
            startDate: summary.startDate,
            endDate: summary.endDate,
          },
          timetable,
        },
      });
    } catch (err) {
      console.error("Error retrieving admit card data:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve admit card data" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.get(
  "/download/:examId",
  requireAuth,
  requireRoles([Role.STUDENT]),
  zValidator("param", examParamSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid exam id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    try {
      const { examId } = c.req.valid("param");
      const user = (c as any).get("user") as { id: string };
      const student = await findStudentByUserId(user.id);

      if (!student) {
        return c.json<ErrorResponse>(
          { success: false, error: "Student profile not found" },
          HttpStatus.NotFound,
        );
      }

      const examResults = await getStudentExamResults(student.studentId, examId);
      const result = examResults[0];

      const access = await evaluateStudentResultAccess(examId, student.studentId);
      if (!access) {
        return c.json<ErrorResponse>(
          { success: false, error: "Result access data not found for this student" },
          HttpStatus.NotFound,
        );
      }
      if (!access.allowed) {
        return c.json<ErrorResponse>(
          { success: false, error: access.reason ?? "Result access is blocked for this student" },
          HttpStatus.Forbidden,
        );
      }

      if (!result) {
        return c.json<ErrorResponse>(
          { success: false, error: "Result not found for this exam" },
          HttpStatus.NotFound,
        );
      }
      if (result.status === "pending") {
        return c.json<ErrorResponse>(
          { success: false, error: "Result is pending because marks are incomplete" },
          HttpStatus.BadRequest,
        );
      }

      const pdfBytes = await generateStudentCopyPdf(student, result);
      const fileName = `${sanitizeFilePart(student.enrollmentNo ?? student.rollNumber ?? student.studentId)}_${sanitizeFilePart(result.examName)}_student-copy.pdf`;
      return new Response(pdfBytes.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      console.error("Error generating student result PDF:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to generate PDF" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.get(
  "/download/bulk/:examId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("param", examParamSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid exam id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    try {
      const { examId } = c.req.valid("param");

      const enrolledStudents = await db
        .select({
          studentId: studentsTable.id,
          rollNumber: studentsTable.rollNumber,
          fullName: usersTable.fullName,
        })
        .from(studentExamEnrollmentsTable)
        .innerJoin(
          studentsTable,
          eq(studentExamEnrollmentsTable.studentId, studentsTable.id),
        )
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .where(eq(studentExamEnrollmentsTable.examId, examId))
        .orderBy(asc(studentsTable.rollNumber), asc(usersTable.fullName));

      if (!enrolledStudents.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "No enrolled students found for this exam" },
          HttpStatus.NotFound,
        );
      }

      const mergedPdf = await PDFDocument.create();
      let generatedCount = 0;
      let examName = "exam";

      for (const entry of enrolledStudents) {
        let marksheetData: OfficialMarksheetData | null = null;
        try {
          marksheetData = await buildOfficialMarksheetData(entry.studentId, examId);
        } catch {
          marksheetData = null;
        }
        if (!marksheetData) continue;

        examName = marksheetData.exam.examName;
        const pdfBytes = await generateOfficialResultPdf(marksheetData);
        const sourcePdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices(),
        );
        for (const page of copiedPages) {
          mergedPdf.addPage(page);
        }
        generatedCount += 1;
      }

      if (generatedCount === 0) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error:
              "No completed results found for this exam. Bulk PDF requires non-pending results.",
          },
          HttpStatus.BadRequest,
        );
      }

      const mergedPdfBytes = await mergedPdf.save();
      const fileName = `${sanitizeFilePart(examName)}_bulk-official-results_${generatedCount}.pdf`;

      return new Response(mergedPdfBytes.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      console.error("Error generating bulk result PDF:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to generate bulk result PDF" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.get(
  "/official-marksheet/bulk/:examId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("param", examParamSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid exam id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    try {
      const { examId } = c.req.valid("param");

      const enrolledStudents = await db
        .select({
          studentId: studentsTable.id,
          rollNumber: studentsTable.rollNumber,
          fullName: usersTable.fullName,
        })
        .from(studentExamEnrollmentsTable)
        .innerJoin(
          studentsTable,
          eq(studentExamEnrollmentsTable.studentId, studentsTable.id),
        )
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .where(eq(studentExamEnrollmentsTable.examId, examId))
        .orderBy(asc(studentsTable.rollNumber), asc(usersTable.fullName));

      if (!enrolledStudents.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "No enrolled students found for this exam" },
          HttpStatus.NotFound,
        );
      }

      const marksheets: OfficialMarksheetData[] = [];
      for (const entry of enrolledStudents) {
        try {
          const data = await buildOfficialMarksheetData(entry.studentId, examId);
          marksheets.push(data);
        } catch {
          // Skip students with pending/missing marksheet data.
        }
      }

      if (!marksheets.length) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error:
              "No completed official marksheets found for this exam. Ensure all marks are entered.",
          },
          HttpStatus.BadRequest,
        );
      }

      return c.json<SuccessResponse<{ examId: string; count: number; marksheets: OfficialMarksheetData[] }>>({
        success: true,
        message: "Bulk official marksheet data retrieved successfully",
        data: {
          examId,
          count: marksheets.length,
          marksheets,
        },
      });
    } catch (err) {
      console.error("Error retrieving bulk official marksheet data:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve bulk official marksheet data" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.get(
  "/official-marksheet/:studentId/:examId",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER, Role.STUDENT]),
  zValidator("param", marksheetParamSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid student or exam id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    try {
      const { studentId, examId } = c.req.valid("param");
      const student = await findStudentByStudentId(studentId);
      const user = c.get("user") as { id: string };
      const userRoles = (c.get("userRole") as string[]) ?? [];

      if (!student) {
        return c.json<ErrorResponse>(
          { success: false, error: "Student not found" },
          HttpStatus.NotFound,
        );
      }

      if (userRoles.includes(Role.STUDENT) && student.userId !== user.id) {
        return c.json<ErrorResponse>(
          { success: false, error: "Forbidden" },
          HttpStatus.Forbidden,
        );
      }

      if (userRoles.includes(Role.STUDENT)) {
        const access = await evaluateStudentResultAccess(examId, studentId);
        if (!access) {
          return c.json<ErrorResponse>(
            { success: false, error: "Result access data not found for this student" },
            HttpStatus.NotFound,
          );
        }
        if (!access.allowed) {
          return c.json<ErrorResponse>(
            { success: false, error: access.reason ?? "Result access is blocked for this student" },
            HttpStatus.Forbidden,
          );
        }
      }

      const data = await buildOfficialMarksheetData(studentId, examId);

      return c.json<SuccessResponse>({
        success: true,
        message: "Official marksheet data retrieved successfully",
        data,
      });
    } catch (err) {
      console.error("Error retrieving official marksheet:", err);
      if (err instanceof Error) {
        if (err.message === "Student not found") {
          return c.json<ErrorResponse>(
            { success: false, error: err.message },
            HttpStatus.NotFound,
          );
        }
        if (
          err.message === "No result found for selected student and exam" ||
          err.message === "Official marksheet cannot be generated until all marks are entered"
        ) {
          return c.json<ErrorResponse>(
            { success: false, error: err.message },
            HttpStatus.BadRequest,
          );
        }
      }
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve official marksheet" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

resultsRouter.get(
  "/rt-sheet/:examId",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  zValidator("param", examParamSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid exam id" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    try {
      const { examId } = c.req.valid("param");

      const rows = await db
        .select({
          examId: examsTable.id,
          examName: examsTable.name,
          examType: examsTable.examType,
          academicYear: examsTable.academicYear,
          startDate: examsTable.startDate,
          endDate: examsTable.endDate,
          examClassName: classesTable.name,
          sessionName: academicSessionsTable.name,
          studentId: studentsTable.id,
          rollNumber: studentsTable.rollNumber,
          enrollmentNo: studentsTable.enrollmentNo,
          fathersName: studentsTable.fathersName,
          studentClassName: classesTable.name,
          fullName: usersTable.fullName,
          examSubjectId: examSubjectsTable.id,
          examDate: examSubjectsTable.examDate,
          subjectStartTime: examSubjectsTable.startTime,
          subjectEndTime: examSubjectsTable.endTime,
          subjectId: subjectsTable.id,
          subjectName: subjectsTable.name,
          subjectCode: subjectsTable.code,
          component: examSubjectComponentsTable.component,
          componentMaxMarks: examSubjectComponentsTable.maxMarks,
          componentPassMarks: examSubjectComponentsTable.passMarks,
          obtainedMarks: studentMarksTable.obtainedMarks,
        })
        .from(studentExamEnrollmentsTable)
        .innerJoin(examsTable, eq(studentExamEnrollmentsTable.examId, examsTable.id))
        .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
        .innerJoin(
          academicSessionsTable,
          eq(examsTable.sessionId, academicSessionsTable.id),
        )
        .innerJoin(
          studentsTable,
          eq(studentExamEnrollmentsTable.studentId, studentsTable.id),
        )
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .innerJoin(
          examSubjectsTable,
          eq(examSubjectsTable.examId, studentExamEnrollmentsTable.examId),
        )
        .innerJoin(subjectsTable, eq(examSubjectsTable.subjectId, subjectsTable.id))
        .innerJoin(
          examSubjectComponentsTable,
          eq(examSubjectComponentsTable.examSubjectId, examSubjectsTable.id),
        )
        .leftJoin(
          studentMarksTable,
          and(
            eq(studentMarksTable.studentId, studentExamEnrollmentsTable.studentId),
            eq(studentMarksTable.examSubjectId, examSubjectsTable.id),
            eq(studentMarksTable.component, examSubjectComponentsTable.component),
          ),
        )
        .where(eq(studentExamEnrollmentsTable.examId, examId))
        .orderBy(
          asc(studentsTable.rollNumber),
          asc(usersTable.fullName),
          asc(subjectsTable.name),
          asc(examSubjectComponentsTable.component),
        );

      if (!rows.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found or no enrolled students" },
          HttpStatus.NotFound,
        );
      }

      const exam = {
        examId: rows[0].examId,
        examName: rows[0].examName,
        examType: rows[0].examType,
        examTypeLabel: EXAM_TYPE_LABELS[rows[0].examType],
        academicYear: rows[0].academicYear,
        startDate: rows[0].startDate,
        endDate: rows[0].endDate,
        className: rows[0].examClassName,
        sessionName: rows[0].sessionName,
      };

      const subjectMetaMap = new Map<string, {
        examSubjectId: string;
        subjectId: string;
        subjectName: string;
        subjectCode: string;
        examDate: Date | null;
        startTime: Date | null;
        endTime: Date | null;
      }>();

      const studentMap = new Map<string, {
        serialNumber: number;
        studentId: string;
        rollNumber: string | null;
        enrollmentNo: string | null;
        fullName: string;
        fatherName: string;
        className: string;
        subjectMarks: Record<string, SubjectResultItem>;
      }>();

      for (const row of rows) {
        if (!subjectMetaMap.has(row.examSubjectId)) {
          subjectMetaMap.set(row.examSubjectId, {
            examSubjectId: row.examSubjectId,
            subjectId: row.subjectId,
            subjectName: row.subjectName,
            subjectCode: row.subjectCode,
            examDate: row.examDate,
            startTime: row.subjectStartTime,
            endTime: row.subjectEndTime,
          });
        }

        if (!studentMap.has(row.studentId)) {
          studentMap.set(row.studentId, {
            serialNumber: studentMap.size + 1,
            studentId: row.studentId,
            rollNumber: row.rollNumber,
            enrollmentNo: row.enrollmentNo,
            fullName: row.fullName,
            fatherName: row.fathersName,
            className: row.studentClassName,
            subjectMarks: {},
          });
        }

        const student = studentMap.get(row.studentId)!;
        const existingSubject = student.subjectMarks[row.examSubjectId] ?? {
          examSubjectId: row.examSubjectId,
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          subjectCode: row.subjectCode,
          components: [],
          totalObtained: 0,
          totalMax: 0,
          totalPass: 0,
          status: "pending" as const,
        };

        const componentStatus =
          row.obtainedMarks === null
            ? ("pending" as const)
            : row.obtainedMarks >= row.componentPassMarks
              ? ("pass" as const)
              : ("fail" as const);

        existingSubject.components.push({
          component: row.component,
          componentLabel:
            COMPONENT_LABELS[row.component as keyof typeof COMPONENT_LABELS] ?? row.component,
          maxMarks: row.componentMaxMarks,
          passMarks: row.componentPassMarks,
          obtainedMarks: row.obtainedMarks,
          status: componentStatus,
        });
        existingSubject.totalMax += row.componentMaxMarks;
        existingSubject.totalPass += row.componentPassMarks;
        if (row.obtainedMarks !== null) {
          existingSubject.totalObtained += row.obtainedMarks;
        }

        student.subjectMarks[row.examSubjectId] = existingSubject;
      }

      const subjects = Array.from(subjectMetaMap.values());
      const students = Array.from(studentMap.values()).map((student) => {
        const subjectMarks = subjects.map((subject) => {
          const mark = student.subjectMarks[subject.examSubjectId] ?? {
            examSubjectId: subject.examSubjectId,
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            subjectCode: subject.subjectCode,
            components: [],
            totalObtained: 0,
            totalMax: 0,
            totalPass: 0,
            status: "pending" as const,
          };
          const hasPending =
            mark.components.some((item) => item.status === "pending") ||
            mark.components.length === 0;
          mark.status = hasPending
            ? "pending"
            : mark.totalObtained >= mark.totalPass
              ? "pass"
              : "fail";
          return mark;
        });

        const totalObtained = subjectMarks.reduce((sum, item) => sum + item.totalObtained, 0);
        const totalMax = subjectMarks.reduce((sum, item) => sum + item.totalMax, 0);
        const hasPending = subjectMarks.some((item) => item.status === "pending");
        const hasFail = subjectMarks.some((item) => item.status === "fail");
        const percentage = !hasPending && totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
        const status = hasPending ? "pending" : hasFail ? "fail" : "pass";

        return {
          serialNumber: student.serialNumber,
          studentId: student.studentId,
          rollNumber: student.rollNumber,
          enrollmentNo: student.enrollmentNo,
          fullName: student.fullName,
          fatherName: student.fatherName,
          className: student.className,
          subjectMarks,
          totalObtained,
          totalMax,
          percentage: round2(percentage),
          grade: hasPending ? "NA" : getGradeFromPercentage(percentage),
          division: hasPending ? "Pending" : getDivisionFromPercentage(percentage),
          status,
          remarks:
            status === "pass"
              ? "Promoted"
              : status === "fail"
                ? "Needs Improvement"
                : "Result Pending",
        };
      });

      const classAverage =
        students.length > 0
          ? round2(students.reduce((sum, row) => sum + row.percentage, 0) / students.length)
          : 0;
      const passCount = students.filter((row) => row.status === "pass").length;
      const failCount = students.filter((row) => row.status === "fail").length;
      const pendingCount = students.filter((row) => row.status === "pending").length;
      const highestScore = students.length
        ? Math.max(...students.map((row) => row.percentage))
        : 0;

      return c.json<SuccessResponse>({
        success: true,
        message: "RT sheet generated successfully",
        data: {
          exam,
          subjects,
          students,
          summary: {
            classAverage,
            passCount,
            failCount,
            pendingCount,
            highestScore,
            totalStudents: students.length,
          },
        },
      });
    } catch (err) {
      console.error("Error generating RT sheet:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to generate RT sheet" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default resultsRouter;
