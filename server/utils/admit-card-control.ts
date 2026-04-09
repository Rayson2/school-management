import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { academicSessionsTable } from "../db/schemas/academicSessions";
import { classesTable } from "../db/schemas/classes";
import {
  admitCardAccessModeEnum,
  examAdmitCardControlsTable,
  examsTable,
  studentExamEnrollmentsTable,
} from "../db/schemas/exams";
import { feeClassConfigsTable, feeStudentMonthlyTable } from "../db/schemas/fee";
import { studentsTable } from "../db/schemas/students";
import { usersTable } from "../db/schemas/users";
import { inferAdmissionType, resolveGenerationRangeForStudent } from "./fee";

export type AdmitCardAccessMode = (typeof admitCardAccessModeEnum.enumValues)[number];
export type ResultAccessTarget = "admit-card" | "result";

type ExamControlContext = {
  examId: string;
  examName: string;
  examType: string;
  academicYear: string;
  classId: string;
  className: string;
  sessionId: string;
  sessionName: string;
  mode: AdmitCardAccessMode;
  resultMode: AdmitCardAccessMode;
  newStudentAmount: number;
  oldStudentAmount: number;
  updatedAt: Date | null;
  startMonth: number | null;
  startYear: number | null;
  endMonth: number | null;
  endYear: number | null;
  defaultNewAmount: number | null;
  defaultOldAmount: number | null;
};

type StudentContext = {
  studentId: string;
  userId: string;
  fullName: string;
  rollNumber: string;
  enrollmentNo: string | null;
  admissionNo: string | null;
  admissionDate: Date | null;
};

type PaymentRecord = {
  studentId: string;
  month: number;
  year: number;
  amountDue: number;
  amountPaid: number;
  status: "pending" | "partial" | "paid";
};

export type StudentPaymentStatus = {
  studentId: string;
  fullName: string;
  rollNumber: string;
  enrollmentNo: string | null;
  admissionNo: string | null;
  admissionType: "new" | "old";
  paymentStatus: "paid" | "unpaid";
  fullyPaid: boolean;
  requiredMonthCount: number;
  paidMonthCount: number;
  missingMonthCount: number;
  partialMonthCount: number;
  totalExpectedAmount: number;
  totalPaidAmount: number;
  outstandingAmount: number;
  missingMonths: string[];
  partialMonths: string[];
  lastUpdatedAt: Date | null;
  warning: string | null;
};

export type AdmitCardAccessEvaluation = {
  target: ResultAccessTarget;
  mode: AdmitCardAccessMode;
  allowed: boolean;
  reason: string | null;
  paymentStatus: StudentPaymentStatus;
};

const DEFAULT_MODE: AdmitCardAccessMode = "off";

const formatMonthLabel = (month: number, year: number) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const normalizeAmount = (...values: Array<number | null | undefined>): number =>
  values.reduce<number>(
    (max, value) => (typeof value === "number" && value > max ? value : max),
    0,
  );

export const getExamAdmitCardControlContext = async (
  examId: string,
): Promise<ExamControlContext | null> => {
  const rows = await db
    .select({
      examId: examsTable.id,
      examName: examsTable.name,
      examType: examsTable.examType,
      academicYear: examsTable.academicYear,
      classId: examsTable.classId,
      className: classesTable.name,
      sessionId: examsTable.sessionId,
      sessionName: academicSessionsTable.name,
      mode: examAdmitCardControlsTable.mode,
      resultMode: examAdmitCardControlsTable.resultMode,
      newStudentAmount: examAdmitCardControlsTable.newStudentAmount,
      oldStudentAmount: examAdmitCardControlsTable.oldStudentAmount,
      updatedAt: examAdmitCardControlsTable.updatedAt,
      startMonth: feeClassConfigsTable.startMonth,
      startYear: feeClassConfigsTable.startYear,
      endMonth: feeClassConfigsTable.endMonth,
      endYear: feeClassConfigsTable.endYear,
      defaultNewAmount: feeClassConfigsTable.newAdmissionFee,
      defaultOldAmount: feeClassConfigsTable.oldAdmissionFee,
    })
    .from(examsTable)
    .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
    .innerJoin(
      academicSessionsTable,
      eq(examsTable.sessionId, academicSessionsTable.id),
    )
    .leftJoin(examAdmitCardControlsTable, eq(examAdmitCardControlsTable.examId, examsTable.id))
    .leftJoin(
      feeClassConfigsTable,
      and(
        eq(feeClassConfigsTable.classId, examsTable.classId),
        eq(feeClassConfigsTable.sessionId, examsTable.sessionId),
      ),
    )
    .where(eq(examsTable.id, examId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    mode: row.mode ?? DEFAULT_MODE,
    resultMode: row.resultMode ?? DEFAULT_MODE,
    newStudentAmount: row.newStudentAmount ?? 0,
    oldStudentAmount: row.oldStudentAmount ?? 0,
    updatedAt: row.updatedAt ?? null,
  };
};

const getEnrolledStudents = async (examId: string): Promise<StudentContext[]> =>
  db
    .select({
      studentId: studentsTable.id,
      userId: usersTable.id,
      fullName: usersTable.fullName,
      rollNumber: studentsTable.rollNumber,
      enrollmentNo: studentsTable.enrollmentNo,
      admissionNo: studentsTable.admissionNo,
      admissionDate: studentsTable.admissionDate,
    })
    .from(studentExamEnrollmentsTable)
    .innerJoin(studentsTable, eq(studentExamEnrollmentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(eq(studentExamEnrollmentsTable.examId, examId))
    .orderBy(asc(usersTable.fullName));

const getFeeRecordsForStudents = async (
  sessionId: string,
  studentIds: string[],
): Promise<PaymentRecord[]> => {
  if (!studentIds.length) return [];

  return db
    .select({
      studentId: feeStudentMonthlyTable.studentId,
      month: feeStudentMonthlyTable.month,
      year: feeStudentMonthlyTable.year,
      amountDue: feeStudentMonthlyTable.amountDue,
      amountPaid: feeStudentMonthlyTable.amountPaid,
      status: feeStudentMonthlyTable.status,
    })
    .from(feeStudentMonthlyTable)
    .where(
      and(
        eq(feeStudentMonthlyTable.sessionId, sessionId),
        inArray(feeStudentMonthlyTable.studentId, studentIds),
      ),
    );
};

const buildStudentStatus = (
  student: StudentContext,
  context: ExamControlContext,
  feeRecords: Map<string, PaymentRecord>,
): StudentPaymentStatus => {
  const admissionType = inferAdmissionType(student.admissionDate, context.sessionName);
  const configuredAmount =
    admissionType === "new"
      ? normalizeAmount(context.newStudentAmount, context.defaultNewAmount)
      : normalizeAmount(context.oldStudentAmount, context.defaultOldAmount);

  if (
    !context.startMonth ||
    !context.startYear ||
    !context.endMonth ||
    !context.endYear
  ) {
    return {
      studentId: student.studentId,
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      enrollmentNo: student.enrollmentNo,
      admissionNo: student.admissionNo,
      admissionType,
      paymentStatus: "unpaid",
      fullyPaid: false,
      requiredMonthCount: 0,
      paidMonthCount: 0,
      missingMonthCount: 0,
      partialMonthCount: 0,
      totalExpectedAmount: configuredAmount,
      totalPaidAmount: 0,
      outstandingAmount: configuredAmount,
      missingMonths: [],
      partialMonths: [],
      lastUpdatedAt: context.updatedAt,
      warning: "Fee month range is not configured for this exam's class/session.",
    };
  }

  const rangeResult = resolveGenerationRangeForStudent({
    admissionType,
    admissionDate: student.admissionDate,
    sessionName: context.sessionName,
    startMonth: context.startMonth,
    startYear: context.startYear,
    endMonth: context.endMonth,
    endYear: context.endYear,
  });

  const missingMonths: string[] = [];
  const partialMonths: string[] = [];
  let paidMonthCount = 0;
  let totalPaidAmount = 0;
  const totalExpectedAmount = configuredAmount;

  for (const item of rangeResult.monthYearRange) {
    const key = `${item.year}-${item.month}`;
    const record = feeRecords.get(key);
    const expectedAmount = normalizeAmount(record?.amountDue, configuredAmount);

    if (!record) {
      missingMonths.push(formatMonthLabel(item.month, item.year));
      continue;
    }

    totalPaidAmount += record.amountPaid;

    if (record.amountPaid >= expectedAmount && record.status === "paid") {
      paidMonthCount += 1;
      continue;
    }

    if (record.amountPaid > 0) {
      partialMonths.push(formatMonthLabel(item.month, item.year));
    } else {
      missingMonths.push(formatMonthLabel(item.month, item.year));
    }
  }

  const fullyPaid =
    !rangeResult.skipped &&
    totalPaidAmount >= totalExpectedAmount;

  const outstandingAmount = Math.max(totalExpectedAmount - totalPaidAmount, 0);

  let warning: string | null = null;
  if (rangeResult.skipped) {
    warning = "Admission month falls after the configured fee range.";
  } else if (!rangeResult.monthYearRange.length) {
    warning = "No fee months are required for this student in the configured range.";
  } else if (fullyPaid && (missingMonths.length > 0 || partialMonths.length > 0)) {
    warning = "Lump amount is fully paid, but monthly entries are incomplete or partial.";
  } else if (!configuredAmount) {
    warning = "Configured lump amount is 0.";
  } else if (!fullyPaid) {
    warning = `Outstanding amount: ${outstandingAmount}. Admit card stays blocked until the lump amount is cleared.`;
  }

  return {
    studentId: student.studentId,
    fullName: student.fullName,
    rollNumber: student.rollNumber,
    enrollmentNo: student.enrollmentNo,
    admissionNo: student.admissionNo,
    admissionType,
    paymentStatus: fullyPaid ? "paid" : "unpaid",
    fullyPaid,
    requiredMonthCount: rangeResult.monthYearRange.length,
    paidMonthCount,
    missingMonthCount: missingMonths.length,
    partialMonthCount: partialMonths.length,
    totalExpectedAmount,
    totalPaidAmount,
    outstandingAmount,
    missingMonths,
    partialMonths,
    lastUpdatedAt: context.updatedAt,
    warning,
  };
};

export const getExamAdmitCardStudentStatuses = async (examId: string) => {
  const context = await getExamAdmitCardControlContext(examId);
  if (!context) return null;

  const students = await getEnrolledStudents(examId);
  const feeRows = await getFeeRecordsForStudents(
    context.sessionId,
    students.map((student) => student.studentId),
  );

  const feeMap = new Map<string, Map<string, PaymentRecord>>();
  for (const row of feeRows) {
    if (!feeMap.has(row.studentId)) {
      feeMap.set(row.studentId, new Map());
    }
    feeMap.get(row.studentId)!.set(`${row.year}-${row.month}`, row);
  }

  const statuses = students.map((student) =>
    buildStudentStatus(student, context, feeMap.get(student.studentId) ?? new Map()),
  );

  return {
    context,
    students: statuses,
  };
};

export const evaluateStudentDocumentAccess = async (
  examId: string,
  studentId: string,
  target: ResultAccessTarget,
): Promise<AdmitCardAccessEvaluation | null> => {
  const result = await getExamAdmitCardStudentStatuses(examId);
  if (!result) return null;

  const paymentStatus = result.students.find((student) => student.studentId === studentId);
  if (!paymentStatus) return null;

  const mode = target === "result" ? result.context.resultMode : result.context.mode;
  let allowed = false;
  let reason: string | null = null;

  switch (mode) {
    case "all":
      allowed = true;
      break;
    case "only_paid":
      allowed = paymentStatus.fullyPaid;
      if (!allowed) {
        if (paymentStatus.warning) {
          reason = paymentStatus.warning;
        } else if (paymentStatus.partialMonthCount > 0 || paymentStatus.missingMonthCount > 0) {
          reason =
            target === "result"
              ? "Result access is blocked until the configured fee amount is fully paid."
              : "Admit card is blocked until the configured fee amount is fully paid.";
        } else {
          reason =
            target === "result"
              ? "Result is currently unavailable."
              : "Admit card is currently unavailable.";
        }
      }
      break;
    case "off":
    default:
      reason =
        target === "result"
          ? "Result access is currently turned off by the admin."
          : "Admit card access is currently turned off by the admin.";
      allowed = false;
      break;
  }

  return {
    target,
    mode,
    allowed,
    reason,
    paymentStatus,
  };
};

export const evaluateStudentAdmitCardAccess = async (
  examId: string,
  studentId: string,
) => evaluateStudentDocumentAccess(examId, studentId, "admit-card");

export const evaluateStudentResultAccess = async (
  examId: string,
  studentId: string,
) => evaluateStudentDocumentAccess(examId, studentId, "result");
