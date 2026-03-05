import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import * as XLSX from "xlsx";
import z from "zod";
import { db } from "../db";
import { academicSessionsTable } from "../db/schemas/academicSessions";
import { classesTable } from "../db/schemas/classes";
import {
  feeAdmissionTypeEnum,
  feeClassConfigsTable,
  feeEntryStatusEnum,
  feePaymentModeEnum,
  feeStudentMonthlyTable,
} from "../db/schemas/fee";
import { studentsTable } from "../db/schemas/students";
import { usersTable } from "../db/schemas/users";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { Role } from "../utils/roles";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";

const feeRouter = new Hono();

const monthSchema = z.coerce.number().int().min(1).max(12);
const yearSchema = z.coerce.number().int().min(2000).max(2100);
const moneySchema = z.coerce.number().int().min(0);
const uuidSchema = z.string().uuid();

const classConfigSchema = z.object({
  classId: uuidSchema,
  sessionId: uuidSchema,
  newAdmissionFee: moneySchema,
  oldAdmissionFee: moneySchema,
  startMonth: monthSchema,
  startYear: yearSchema,
  endMonth: monthSchema,
  endYear: yearSchema,
}).refine(
  (value) => {
    const start = value.startYear * 12 + value.startMonth;
    const end = value.endYear * 12 + value.endMonth;
    return end >= start;
  },
  {
    message: "end month/year must be after or equal to start month/year",
    path: ["endYear"],
  },
);

const manualEntrySchema = z.object({
  studentId: uuidSchema,
  month: monthSchema,
  year: yearSchema,
  amountPaid: moneySchema,
  amountDue: moneySchema.optional(),
  paymentMode: z.enum(feePaymentModeEnum.enumValues).optional(),
  referenceNumber: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().or(z.string().date()).optional(),
});

const autoGenerateSchema = z.object({
  sessionId: uuidSchema,
});

const computeStatus = (amountDue: number, amountPaid: number): "pending" | "partial" | "paid" => {
  if (amountPaid <= 0) return "pending";
  if (amountPaid >= amountDue) return "paid";
  return "partial";
};

const parseSessionStartYear = (sessionName: string) => {
  const match = sessionName.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
};

const parseSessionYearRange = (sessionName: string) => {
  const matches = sessionName.match(/(19|20)\d{2}/g) ?? [];
  if (matches.length >= 2) {
    return {
      startYear: Number(matches[0]),
      endYear: Number(matches[1]),
    };
  }
  const startYear = matches.length ? Number(matches[0]) : null;
  if (!startYear) return null;
  return { startYear, endYear: startYear + 1 };
};

const inferAdmissionType = (
  admissionDate: Date | null,
  sessionName: string,
): "new" | "old" => {
  if (!admissionDate) return "old";
  const startYear = parseSessionStartYear(sessionName);
  if (!startYear) return "old";
  const year = admissionDate.getUTCFullYear();
  return year >= startYear ? "new" : "old";
};

const normalizeHeader = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const toDateOrNull = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseMonth = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12) {
    return value;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 12) return asNumber;

  const names = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const idx = names.indexOf(trimmed.toLowerCase());
  return idx >= 0 ? idx + 1 : null;
};

const buildMonthYearRange = (
  startMonth: number,
  startYear: number,
  endMonth: number,
  endYear: number,
) => {
  const start = startYear * 12 + (startMonth - 1);
  const end = endYear * 12 + (endMonth - 1);
  if (end < start) return [];

  const out: Array<{ month: number; year: number }> = [];
  for (let value = start; value <= end; value += 1) {
    out.push({
      year: Math.floor(value / 12),
      month: (value % 12) + 1,
    });
  }
  return out;
};

const computeActiveMonths = (
  startMonth: number,
  startYear: number,
  endMonth: number,
  endYear: number,
) => buildMonthYearRange(startMonth, startYear, endMonth, endYear).length;

const resolveGenerationRangeForStudent = (input: {
  admissionType: "new" | "old";
  admissionDate: Date | null;
  sessionName: string;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
}) => {
  const monthYearRange = buildMonthYearRange(
    input.startMonth,
    input.startYear,
    input.endMonth,
    input.endYear,
  );

  if (input.admissionType !== "new" || !input.admissionDate) {
    return { monthYearRange, skipped: false };
  }

  const sessionRange = parseSessionYearRange(input.sessionName);
  if (!sessionRange) {
    return { monthYearRange, skipped: false };
  }

  const admissionYear = input.admissionDate.getUTCFullYear();
  const admissionMonth = input.admissionDate.getUTCMonth() + 1;
  const admissionInSession =
    admissionYear >= sessionRange.startYear && admissionYear <= sessionRange.endYear;

  if (!admissionInSession) {
    return { monthYearRange, skipped: false };
  }

  const admissionIndex = monthYearRange.findIndex(
    (item) => item.year === admissionYear && item.month === admissionMonth,
  );

  if (admissionIndex < 0) {
    const isAfterRange =
      admissionYear > monthYearRange[monthYearRange.length - 1]!.year ||
      (admissionYear === monthYearRange[monthYearRange.length - 1]!.year &&
        admissionMonth > monthYearRange[monthYearRange.length - 1]!.month);

    if (isAfterRange) {
      return { monthYearRange: [], skipped: true };
    }
    return { monthYearRange, skipped: false };
  }

  return {
    monthYearRange: monthYearRange.slice(admissionIndex),
    skipped: false,
  };
};

feeRouter.get(
  "/meta",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const [sessions, classes] = await Promise.all([
        db
          .select({
            id: academicSessionsTable.id,
            name: academicSessionsTable.name,
            createdAt: academicSessionsTable.createdAt,
          })
          .from(academicSessionsTable)
          .orderBy(desc(academicSessionsTable.createdAt)),
        db
          .select({
            id: classesTable.id,
            name: classesTable.name,
          })
          .from(classesTable)
          .orderBy(asc(classesTable.name)),
      ]);

      return c.json<SuccessResponse>({
        success: true,
        message: "Fee metadata retrieved successfully",
        data: {
          sessions,
          classes,
          currentSessionId: sessions[0]?.id ?? null,
        },
      });
    } catch (err) {
      console.error("Error loading fee metadata:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to load fee metadata" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

feeRouter.get(
  "/class-config",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const sessionId = c.req.query("sessionId");

    if (!sessionId || !uuidSchema.safeParse(sessionId).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Valid sessionId is required" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const rows = await db
        .select({
          id: classesTable.id,
          className: classesTable.name,
          configId: feeClassConfigsTable.id,
          sessionId: feeClassConfigsTable.sessionId,
          newAdmissionFee: feeClassConfigsTable.newAdmissionFee,
          oldAdmissionFee: feeClassConfigsTable.oldAdmissionFee,
          startMonth: feeClassConfigsTable.startMonth,
          startYear: feeClassConfigsTable.startYear,
          endMonth: feeClassConfigsTable.endMonth,
          endYear: feeClassConfigsTable.endYear,
          activeMonths: feeClassConfigsTable.activeMonths,
          updatedAt: feeClassConfigsTable.updatedAt,
        })
        .from(classesTable)
        .leftJoin(
          feeClassConfigsTable,
          and(
            eq(feeClassConfigsTable.classId, classesTable.id),
            eq(feeClassConfigsTable.sessionId, sessionId),
          ),
        )
        .orderBy(asc(classesTable.name));

      return c.json<SuccessResponse>({
        success: true,
        message: "Class fee config retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error loading class fee config:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to load class fee config" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

feeRouter.post(
  "/class-config",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", classConfigSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid class fee configuration payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user") as { id: string };

    try {
      const activeMonths = computeActiveMonths(
        body.startMonth,
        body.startYear,
        body.endMonth,
        body.endYear,
      );
      await db
        .insert(feeClassConfigsTable)
        .values({
          classId: body.classId,
          sessionId: body.sessionId,
          newAdmissionFee: body.newAdmissionFee,
          oldAdmissionFee: body.oldAdmissionFee,
          startMonth: body.startMonth,
          startYear: body.startYear,
          endMonth: body.endMonth,
          endYear: body.endYear,
          activeMonths,
          createdBy: user.id,
        })
        .onConflictDoUpdate({
          target: [feeClassConfigsTable.classId, feeClassConfigsTable.sessionId],
          set: {
            newAdmissionFee: body.newAdmissionFee,
            oldAdmissionFee: body.oldAdmissionFee,
            startMonth: body.startMonth,
            startYear: body.startYear,
            endMonth: body.endMonth,
            endYear: body.endYear,
            activeMonths,
            createdBy: user.id,
            updatedAt: new Date(),
          },
        });

      return c.json<SuccessResponse>({
        success: true,
        message: "Class fee configuration saved successfully",
      });
    } catch (err) {
      console.error("Error saving class fee config:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to save class fee configuration" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

feeRouter.post(
  "/manual-entry",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", manualEntrySchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid manual fee payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user") as { id: string };

    try {
      const studentRows = await db
        .select({
          id: studentsTable.id,
          classId: studentsTable.classId,
          sessionId: studentsTable.sessionId,
          admissionDate: studentsTable.admissionDate,
          sessionName: academicSessionsTable.name,
        })
        .from(studentsTable)
        .innerJoin(
          academicSessionsTable,
          eq(studentsTable.sessionId, academicSessionsTable.id),
        )
        .where(eq(studentsTable.id, body.studentId))
        .limit(1);

      const student = studentRows[0];
      if (!student) {
        return c.json<ErrorResponse>(
          { success: false, error: "Student not found" },
          HttpStatus.NotFound,
        );
      }

      const configRows = await db
        .select({
          newAdmissionFee: feeClassConfigsTable.newAdmissionFee,
          oldAdmissionFee: feeClassConfigsTable.oldAdmissionFee,
        })
        .from(feeClassConfigsTable)
        .where(
          and(
            eq(feeClassConfigsTable.classId, student.classId),
            eq(feeClassConfigsTable.sessionId, student.sessionId),
          ),
        )
        .limit(1);

      const config = configRows[0];
      if (!config) {
        return c.json<ErrorResponse>(
          { success: false, error: "Class fee config not found for this student" },
          HttpStatus.BadRequest,
        );
      }

      const admissionType = inferAdmissionType(student.admissionDate, student.sessionName);
      const amountDue =
        body.amountDue ?? (admissionType === "new" ? config.newAdmissionFee : config.oldAdmissionFee);

      const amountPaid = body.amountPaid;
      const status = computeStatus(amountDue, amountPaid);

      await db
        .insert(feeStudentMonthlyTable)
        .values({
          studentId: student.id,
          classId: student.classId,
          sessionId: student.sessionId,
          month: body.month,
          year: body.year,
          admissionType,
          amountDue,
          amountPaid,
          status,
          paymentMode: amountPaid > 0 ? body.paymentMode ?? null : null,
          referenceNumber: amountPaid > 0 ? body.referenceNumber?.trim() ?? null : null,
          paidAt: amountPaid > 0 ? toDateOrNull(body.paidAt) ?? new Date() : null,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .onConflictDoUpdate({
          target: [
            feeStudentMonthlyTable.studentId,
            feeStudentMonthlyTable.sessionId,
            feeStudentMonthlyTable.month,
            feeStudentMonthlyTable.year,
          ],
          set: {
            amountDue,
            amountPaid,
            status,
            paymentMode: amountPaid > 0 ? body.paymentMode ?? null : null,
            referenceNumber: amountPaid > 0 ? body.referenceNumber?.trim() ?? null : null,
            paidAt: amountPaid > 0 ? toDateOrNull(body.paidAt) ?? new Date() : null,
            updatedBy: user.id,
            updatedAt: new Date(),
          },
        });

      return c.json<SuccessResponse>({
        success: true,
        message: "Manual student fee entry saved successfully",
      });
    } catch (err) {
      console.error("Error saving manual fee entry:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to save manual fee entry" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

feeRouter.post(
  "/auto-generate",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", autoGenerateSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid auto generate payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user") as { id: string };

    try {
      const sessionRows = await db
        .select({
          id: academicSessionsTable.id,
          name: academicSessionsTable.name,
        })
        .from(academicSessionsTable)
        .where(eq(academicSessionsTable.id, body.sessionId))
        .limit(1);

      const session = sessionRows[0];
      if (!session) {
        return c.json<ErrorResponse>(
          { success: false, error: "Session not found" },
          HttpStatus.NotFound,
        );
      }

      const [students, configs] = await Promise.all([
        db
          .select({
            studentId: studentsTable.id,
            classId: studentsTable.classId,
            admissionDate: studentsTable.admissionDate,
          })
          .from(studentsTable)
          .where(eq(studentsTable.sessionId, body.sessionId)),
        db
          .select({
            classId: feeClassConfigsTable.classId,
            newAdmissionFee: feeClassConfigsTable.newAdmissionFee,
            oldAdmissionFee: feeClassConfigsTable.oldAdmissionFee,
            startMonth: feeClassConfigsTable.startMonth,
            startYear: feeClassConfigsTable.startYear,
            endMonth: feeClassConfigsTable.endMonth,
            endYear: feeClassConfigsTable.endYear,
            activeMonths: feeClassConfigsTable.activeMonths,
          })
          .from(feeClassConfigsTable)
          .where(eq(feeClassConfigsTable.sessionId, body.sessionId)),
      ]);

      const configByClass = new Map(configs.map((item) => [item.classId, item]));
      let generatedCount = 0;
      const skipped: Array<{ studentId: string; reason: string }> = [];

      await db.transaction(async (tx) => {
        for (const student of students) {
          const config = configByClass.get(student.classId);
          if (!config) {
            skipped.push({ studentId: student.studentId, reason: "Class fee config missing" });
            continue;
          }

          const admissionType = inferAdmissionType(student.admissionDate, session.name);
          const amountDue = admissionType === "new" ? config.newAdmissionFee : config.oldAdmissionFee;

          const rangeResult = resolveGenerationRangeForStudent({
            admissionType,
            admissionDate: student.admissionDate,
            sessionName: session.name,
            startMonth: config.startMonth,
            startYear: config.startYear,
            endMonth: config.endMonth,
            endYear: config.endYear,
          });

          if (rangeResult.skipped || !rangeResult.monthYearRange.length) {
            skipped.push({
              studentId: student.studentId,
              reason: "Admission month is after configured fee range",
            });
            continue;
          }

          for (const item of rangeResult.monthYearRange) {
            await tx
              .insert(feeStudentMonthlyTable)
              .values({
                studentId: student.studentId,
                classId: student.classId,
                sessionId: body.sessionId,
                month: item.month,
                year: item.year,
                admissionType,
                amountDue,
                amountPaid: 0,
                status: "pending",
                createdBy: user.id,
                updatedBy: user.id,
              })
              .onConflictDoNothing({
                target: [
                  feeStudentMonthlyTable.studentId,
                  feeStudentMonthlyTable.sessionId,
                  feeStudentMonthlyTable.month,
                  feeStudentMonthlyTable.year,
                ],
              });
            generatedCount += 1;
          }
        }
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Student fee data auto-generated successfully",
        data: {
          generatedCount,
          studentCount: students.length,
          skipped,
        },
      });
    } catch (err) {
      console.error("Error generating student fee data:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to auto-generate student fee data" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

const feeRecordUpdateSchema = z
  .object({
    month: monthSchema.optional(),
    year: yearSchema.optional(),
    amountDue: moneySchema.optional(),
    amountPaid: moneySchema.optional(),
    paymentMode: z.enum(feePaymentModeEnum.enumValues).nullable().optional(),
    referenceNumber: z.string().trim().max(120).nullable().optional(),
    paidAt: z.string().datetime().or(z.string().date()).nullable().optional(),
  })
  .refine(
    (value) =>
      value.amountDue === undefined ||
      value.amountPaid === undefined ||
      value.amountPaid <= value.amountDue,
    {
      message: "amountPaid cannot exceed amountDue",
      path: ["amountPaid"],
    },
  );

feeRouter.put(
  "/record/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", feeRecordUpdateSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid fee record update payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const user = c.get("user") as { id: string };

    if (!uuidSchema.safeParse(id).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid fee record id" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({
          id: feeStudentMonthlyTable.id,
          month: feeStudentMonthlyTable.month,
          year: feeStudentMonthlyTable.year,
          amountDue: feeStudentMonthlyTable.amountDue,
          amountPaid: feeStudentMonthlyTable.amountPaid,
        })
        .from(feeStudentMonthlyTable)
        .where(eq(feeStudentMonthlyTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Fee record not found" },
          HttpStatus.NotFound,
        );
      }

      const amountDue = body.amountDue ?? existing[0].amountDue;
      const amountPaid = body.amountPaid ?? existing[0].amountPaid;
      if (amountPaid > amountDue) {
        return c.json<ErrorResponse>(
          { success: false, error: "amountPaid cannot exceed amountDue" },
          HttpStatus.BadRequest,
        );
      }

      await db
        .update(feeStudentMonthlyTable)
        .set({
          month: body.month ?? existing[0].month,
          year: body.year ?? existing[0].year,
          amountDue,
          amountPaid,
          status: computeStatus(amountDue, amountPaid),
          paymentMode: amountPaid > 0 ? (body.paymentMode ?? null) : null,
          referenceNumber: amountPaid > 0 ? (body.referenceNumber?.trim() || null) : null,
          paidAt:
            amountPaid > 0
              ? body.paidAt === null
                ? null
                : toDateOrNull(body.paidAt) ?? new Date()
              : null,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(feeStudentMonthlyTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Fee record updated successfully",
      });
    } catch (err) {
      console.error("Error updating fee record:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update fee record" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

feeRouter.delete(
  "/record/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");
    if (!uuidSchema.safeParse(id).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid fee record id" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({ id: feeStudentMonthlyTable.id })
        .from(feeStudentMonthlyTable)
        .where(eq(feeStudentMonthlyTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Fee record not found" },
          HttpStatus.NotFound,
        );
      }

      await db.delete(feeStudentMonthlyTable).where(eq(feeStudentMonthlyTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Fee record deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting fee record:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete fee record" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

feeRouter.get(
  "/records",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const sessionId = c.req.query("sessionId");
    const classId = c.req.query("classId");
    const status = c.req.query("status");

    if (!sessionId || !uuidSchema.safeParse(sessionId).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Valid sessionId is required" },
        HttpStatus.BadRequest,
      );
    }
    if (classId && !uuidSchema.safeParse(classId).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid classId" },
        HttpStatus.BadRequest,
      );
    }
    if (status && !feeEntryStatusEnum.enumValues.includes(status as any)) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid status" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const rows = await db
        .select({
          id: feeStudentMonthlyTable.id,
          studentId: feeStudentMonthlyTable.studentId,
          studentName: usersTable.fullName,
          rollNumber: studentsTable.rollNumber,
          classId: feeStudentMonthlyTable.classId,
          className: classesTable.name,
          sessionId: feeStudentMonthlyTable.sessionId,
          sessionName: academicSessionsTable.name,
          month: feeStudentMonthlyTable.month,
          year: feeStudentMonthlyTable.year,
          admissionType: feeStudentMonthlyTable.admissionType,
          amountDue: feeStudentMonthlyTable.amountDue,
          amountPaid: feeStudentMonthlyTable.amountPaid,
          status: feeStudentMonthlyTable.status,
          paymentMode: feeStudentMonthlyTable.paymentMode,
          referenceNumber: feeStudentMonthlyTable.referenceNumber,
          paidAt: feeStudentMonthlyTable.paidAt,
          updatedAt: feeStudentMonthlyTable.updatedAt,
        })
        .from(feeStudentMonthlyTable)
        .innerJoin(studentsTable, eq(feeStudentMonthlyTable.studentId, studentsTable.id))
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .innerJoin(classesTable, eq(feeStudentMonthlyTable.classId, classesTable.id))
        .innerJoin(
          academicSessionsTable,
          eq(feeStudentMonthlyTable.sessionId, academicSessionsTable.id),
        )
        .where(
          and(
            eq(feeStudentMonthlyTable.sessionId, sessionId),
            classId ? eq(feeStudentMonthlyTable.classId, classId) : undefined,
            status ? eq(feeStudentMonthlyTable.status, status as any) : undefined,
          ),
        )
        .orderBy(
          asc(classesTable.name),
          asc(usersTable.fullName),
          asc(feeStudentMonthlyTable.year),
          asc(feeStudentMonthlyTable.month),
        );

      return c.json<SuccessResponse>({
        success: true,
        message: "Student fee records retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error loading fee records:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to load fee records" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

feeRouter.get(
  "/download/auto",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const sessionId = c.req.query("sessionId");
    const classId = c.req.query("classId");

    if (!sessionId || !uuidSchema.safeParse(sessionId).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Valid sessionId is required" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const rows = await db
        .select({
          studentId: feeStudentMonthlyTable.studentId,
          studentName: usersTable.fullName,
          rollNumber: studentsTable.rollNumber,
          admissionNo: studentsTable.admissionNo,
          classId: feeStudentMonthlyTable.classId,
          className: classesTable.name,
          sessionId: feeStudentMonthlyTable.sessionId,
          sessionName: academicSessionsTable.name,
          month: feeStudentMonthlyTable.month,
          year: feeStudentMonthlyTable.year,
          admissionType: feeStudentMonthlyTable.admissionType,
          amountDue: feeStudentMonthlyTable.amountDue,
          amountPaid: feeStudentMonthlyTable.amountPaid,
          status: feeStudentMonthlyTable.status,
          paymentMode: feeStudentMonthlyTable.paymentMode,
          referenceNumber: feeStudentMonthlyTable.referenceNumber,
          paidAt: feeStudentMonthlyTable.paidAt,
        })
        .from(feeStudentMonthlyTable)
        .innerJoin(studentsTable, eq(feeStudentMonthlyTable.studentId, studentsTable.id))
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .innerJoin(classesTable, eq(feeStudentMonthlyTable.classId, classesTable.id))
        .innerJoin(
          academicSessionsTable,
          eq(feeStudentMonthlyTable.sessionId, academicSessionsTable.id),
        )
        .where(
          and(
            eq(feeStudentMonthlyTable.sessionId, sessionId),
            classId ? eq(feeStudentMonthlyTable.classId, classId) : undefined,
          ),
        )
        .orderBy(asc(classesTable.name), asc(usersTable.fullName), asc(feeStudentMonthlyTable.month));

      const worksheetRows = rows.map((row) => ({
        studentId: row.studentId,
        studentName: row.studentName,
        rollNumber: row.rollNumber,
        admissionNo: row.admissionNo ?? "",
        classId: row.classId,
        className: row.className,
        sessionId: row.sessionId,
        sessionName: row.sessionName,
        month: row.month,
        year: row.year,
        admissionType: row.admissionType,
        amount_due: row.amountDue,
        amount_paid: row.amountPaid,
        status: row.status,
        paid_mode: row.paymentMode ?? "",
        reference_number: row.referenceNumber ?? "",
        paid_time: row.paidAt ? new Date(row.paidAt).toISOString() : "",
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, "FeeMonthly");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="fee-monthly-${sessionId}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      console.error("Error downloading fee excel:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to download fee excel" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

feeRouter.post(
  "/upload",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const body = await c.req.parseBody({ all: true });
    const file = body.file instanceof File ? body.file : null;
    const user = c.get("user") as { id: string };

    if (!file) {
      return c.json<ErrorResponse>(
        { success: false, error: "Excel file is required" },
        HttpStatus.BadRequest,
      );
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return c.json<ErrorResponse>(
        { success: false, error: "Only .xlsx file is supported" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        return c.json<ErrorResponse>(
          { success: false, error: "No sheet found in file" },
          HttpStatus.BadRequest,
        );
      }

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
        raw: true,
        defval: null,
      });

      const sessionIds = Array.from(
        new Set(
          rawRows
            .map((row) => {
              const normalized: Record<string, unknown> = {};
              Object.entries(row).forEach(([key, value]) => {
                normalized[normalizeHeader(key)] = value;
              });
              const sessionId = normalized.sessionid;
              return typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : null;
            })
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const students = await db
        .select({
          studentId: studentsTable.id,
          classId: studentsTable.classId,
          sessionId: studentsTable.sessionId,
          rollNumber: studentsTable.rollNumber,
          admissionNo: studentsTable.admissionNo,
        })
        .from(studentsTable)
        .where(sessionIds.length ? inArray(studentsTable.sessionId, sessionIds) : undefined);

      const byId = new Map(students.map((s) => [s.studentId, s]));
      const byRoll = new Map(students.map((s) => [s.rollNumber.trim().toLowerCase(), s]));
      const byAdmission = new Map(
        students
          .filter((s) => s.admissionNo)
          .map((s) => [s.admissionNo!.trim().toLowerCase(), s]),
      );

      const errors: Array<{ index: number; error: string }> = [];
      let successCount = 0;

      for (let i = 0; i < rawRows.length; i += 1) {
        const normalized: Record<string, unknown> = {};
        Object.entries(rawRows[i]).forEach(([key, value]) => {
          normalized[normalizeHeader(key)] = value;
        });

        const studentIdRaw = normalized.studentid;
        const rollRaw = normalized.rollnumber;
        const admissionRaw = normalized.admissionno;

        const student =
          (typeof studentIdRaw === "string" ? byId.get(studentIdRaw.trim()) : undefined) ??
          (typeof rollRaw === "string" ? byRoll.get(rollRaw.trim().toLowerCase()) : undefined) ??
          (typeof admissionRaw === "string"
            ? byAdmission.get(admissionRaw.trim().toLowerCase())
            : undefined);

        if (!student) {
          errors.push({ index: i, error: "Student not found" });
          continue;
        }

        const sessionId =
          typeof normalized.sessionid === "string" && normalized.sessionid.trim()
            ? normalized.sessionid.trim()
            : student.sessionId;

        const month = parseMonth(normalized.month);
        const year = Number(normalized.year);

        if (!month || !Number.isInteger(year) || year < 2000 || year > 2100) {
          errors.push({ index: i, error: "Invalid month/year" });
          continue;
        }

        const amountDue = Number(normalized.amountdue ?? normalized.amount_due ?? 0);
        const amountPaid = Number(normalized.amountpaid ?? normalized.amount_paid ?? 0);
        const admissionTypeRaw = String(normalized.admissiontype ?? "old").toLowerCase();
        const admissionType =
          admissionTypeRaw === "new" || admissionTypeRaw === "old" ? admissionTypeRaw : "old";
        const modeRaw = normalized.paidmode ?? normalized.paymentmode ?? normalized.paid_mode;
        const paymentMode =
          typeof modeRaw === "string" && feePaymentModeEnum.enumValues.includes(modeRaw as any)
            ? (modeRaw as "cash" | "online" | "cheque")
            : null;
        const referenceRaw = normalized.referencenumber ?? normalized.reference_number;
        const referenceNumber = typeof referenceRaw === "string" ? referenceRaw.trim() : "";
        const paidTimeRaw = normalized.paidtime ?? normalized.paid_time;
        const hasPaidTime =
          paidTimeRaw !== null &&
          paidTimeRaw !== undefined &&
          !(typeof paidTimeRaw === "string" && paidTimeRaw.trim() === "");
        const paidAt =
          typeof paidTimeRaw === "number"
            ? (() => {
                const code = XLSX.SSF.parse_date_code(paidTimeRaw);
                if (!code) return null;
                return new Date(
                  Date.UTC(code.y, code.m - 1, code.d, code.H, code.M, Math.floor(code.S)),
                );
              })()
            : toDateOrNull(typeof paidTimeRaw === "string" ? paidTimeRaw : undefined);

        const safeAmountDue = Number.isFinite(amountDue) && amountDue >= 0 ? Math.floor(amountDue) : 0;
        const safeAmountPaid = Number.isFinite(amountPaid) && amountPaid >= 0 ? Math.floor(amountPaid) : 0;
        if (hasPaidTime && !paidAt) {
          errors.push({ index: i, error: "Invalid paid_time value" });
          continue;
        }

        await db
          .insert(feeStudentMonthlyTable)
          .values({
            studentId: student.studentId,
            classId: student.classId,
            sessionId,
            month,
            year,
            admissionType,
            amountDue: safeAmountDue,
            amountPaid: safeAmountPaid,
            status: computeStatus(safeAmountDue, safeAmountPaid),
            paymentMode: safeAmountPaid > 0 ? paymentMode : null,
            referenceNumber: safeAmountPaid > 0 ? referenceNumber || null : null,
            paidAt: safeAmountPaid > 0 ? paidAt : null,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .onConflictDoUpdate({
            target: [
              feeStudentMonthlyTable.studentId,
              feeStudentMonthlyTable.sessionId,
              feeStudentMonthlyTable.month,
              feeStudentMonthlyTable.year,
            ],
            set: {
              amountDue: safeAmountDue,
              amountPaid: safeAmountPaid,
              admissionType,
              status: computeStatus(safeAmountDue, safeAmountPaid),
              paymentMode: safeAmountPaid > 0 ? paymentMode : null,
              referenceNumber: safeAmountPaid > 0 ? referenceNumber || null : null,
              paidAt: safeAmountPaid > 0 ? paidAt : null,
              updatedBy: user.id,
              updatedAt: new Date(),
            },
          });

        successCount += 1;
      }

      return c.json<SuccessResponse>({
        success: true,
        message: "Fee excel upload completed",
        data: {
          totalProcessed: rawRows.length,
          successCount,
          failedCount: errors.length,
          errors,
        },
      });
    } catch (err) {
      console.error("Error uploading fee excel:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to process fee excel upload" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default feeRouter;
