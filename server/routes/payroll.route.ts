
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import z from "zod";
import { db } from "../db";
import { academicSessionsTable } from "../db/schemas/academicSessions";
import { payrollStatusEnum, payrollTable } from "../db/schemas/payroll";
import { teachersTable } from "../db/schemas/teachers";
import { usersTable } from "../db/schemas/users";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { Role } from "../utils/roles";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";

const payrollRouter = new Hono();
const statusValues = payrollStatusEnum.enumValues;

const uuidSchema = z.string().uuid();
const amountSchema = z.coerce.number().int().min(0);
const monthSchema = z.coerce.number().int().min(1).max(12);
const yearSchema = z.coerce.number().int().min(2000).max(2100);

const payrollCreateSchema = z.object({
  teacherId: uuidSchema,
  sessionId: uuidSchema,
  month: monthSchema,
  year: yearSchema,
  basicSalary: amountSchema,
  transportAllowance: amountSchema.default(0),
  otherAllowances: amountSchema.default(0),
  deductions: amountSchema.default(0),
  status: z.enum(statusValues).optional(),
  paymentMode: z.string().trim().max(50).optional(),
  transactionRef: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().or(z.string().date()).optional(),
});

const payrollUpdateSchema = z.object({
  teacherId: uuidSchema.optional(),
  sessionId: uuidSchema.optional(),
  month: monthSchema.optional(),
  year: yearSchema.optional(),
  basicSalary: amountSchema.optional(),
  transportAllowance: amountSchema.optional(),
  otherAllowances: amountSchema.optional(),
  deductions: amountSchema.optional(),
  status: z.enum(statusValues).optional(),
  paymentMode: z.string().trim().max(50).optional(),
  transactionRef: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().or(z.string().date()).nullable().optional(),
});

const payrollBulkRequestSchema = z.object({
  rollbackOnError: z.boolean().optional().default(false),
  records: z.array(z.unknown()).min(1),
});

const payrollBulkUpdateRecordSchema = z.object({
  id: uuidSchema,
  teacherId: uuidSchema.optional(),
  sessionId: uuidSchema.optional(),
  month: monthSchema.optional(),
  year: yearSchema.optional(),
  basicSalary: amountSchema.optional(),
  transportAllowance: amountSchema.optional(),
  otherAllowances: amountSchema.optional(),
  deductions: amountSchema.optional(),
  status: z.enum(statusValues).optional(),
  paymentMode: z.string().trim().max(50).optional(),
  transactionRef: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().or(z.string().date()).nullable().optional(),
});

const paySingleSchema = z.object({
  paymentMode: z.string().trim().max(50).optional(),
  transactionRef: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().or(z.string().date()).optional(),
});

const payBulkRecordSchema = z.object({
  id: uuidSchema,
  paymentMode: z.string().trim().max(50).optional(),
  transactionRef: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().or(z.string().date()).optional(),
});

const unpayBulkRecordSchema = z.object({
  id: uuidSchema,
});

const autoGenerateSchema = z.object({
  sessionId: uuidSchema,
  year: yearSchema,
  months: z.array(monthSchema).min(1),
  overwriteExisting: z.boolean().optional().default(false),
  rollbackOnError: z.boolean().optional().default(false),
});

type BulkError = {
  index: number;
  error: string;
  record?: unknown;
};

class BulkRollbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulkRollbackError";
  }
}

const computeTotals = (payload: {
  basicSalary: number;
  transportAllowance: number;
  otherAllowances: number;
  deductions: number;
}) => {
  const grossSalary = payload.basicSalary + payload.transportAllowance + payload.otherAllowances;
  const netSalary = Math.max(grossSalary - payload.deductions, 0);
  return { grossSalary, netSalary };
};

const toDateOrNull = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const monthLabel = (month: number) => {
  const labels = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return labels[month] ?? String(month);
};

const parseMonthValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12) {
    return value;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;

  const monthNames = [
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
  const index = monthNames.indexOf(trimmed.toLowerCase());
  return index >= 0 ? index + 1 : null;
  return index >= 0 ? index + 1 : null;
};

const normalizeHeader = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const buildNormalizedRow = (row: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }
  return normalized;
};

const getRowValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

const parseAmountValue = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;
  const normalized = value.trim().replace(/,/g, "");
  return normalized.length ? normalized : value;
};

const parseStatusValue = (value: unknown): "pending" | "paid" | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "paid") return "paid";
  if (normalized === "pending") return "pending";
  return null;
};

const parseDateValue = (value: unknown): string | undefined => {
  if (value === null || value === undefined || value === "") return undefined;

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  if (typeof value === "number") {
    const dateCode = XLSX.SSF.parse_date_code(value);
    if (!dateCode) return undefined;
    const asDate = new Date(
      Date.UTC(dateCode.y, dateCode.m - 1, dateCode.d, dateCode.H, dateCode.M, Math.floor(dateCode.S)),
    );
    return Number.isNaN(asDate.getTime()) ? undefined : asDate.toISOString();
  }

  return undefined;
};

const parseTextValue = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text.length ? text : undefined;
};

const findTeacherByUserId = async (userId: string) => {
  const rows = await db
    .select({ id: teachersTable.id })
    .from(teachersTable)
    .where(eq(teachersTable.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
};

const getTeachersForAutoPayroll = async () => {
  const rows = await db
    .select({
      teacherId: teachersTable.id,
      teacherName: usersTable.fullName,
    })
    .from(teachersTable)
    .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .orderBy(usersTable.fullName);
  return rows;
};

const getLatestPayrollTemplate = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  teacherId: string,
  sessionId: string,
) => {
  const rows = await tx
    .select({
      basicSalary: payrollTable.basicSalary,
      transportAllowance: payrollTable.transportAllowance,
      otherAllowances: payrollTable.otherAllowances,
      deductions: payrollTable.deductions,
      year: payrollTable.year,
      month: payrollTable.month,
    })
    .from(payrollTable)
    .where(and(eq(payrollTable.teacherId, teacherId), eq(payrollTable.sessionId, sessionId)))
    .orderBy(desc(payrollTable.year), desc(payrollTable.month))
    .limit(1);

  return (
    rows[0] ?? {
      basicSalary: 0,
      transportAllowance: 0,
      otherAllowances: 0,
      deductions: 0,
      year: 0,
      month: 0,
    }
  );
};

const getPayrollById = async (id: string) => {
  const rows = await db
    .select({
      id: payrollTable.id,
      teacherId: payrollTable.teacherId,
      sessionId: payrollTable.sessionId,
      month: payrollTable.month,
      year: payrollTable.year,
      basicSalary: payrollTable.basicSalary,
      transportAllowance: payrollTable.transportAllowance,
      otherAllowances: payrollTable.otherAllowances,
      deductions: payrollTable.deductions,
      grossSalary: payrollTable.grossSalary,
      netSalary: payrollTable.netSalary,
      status: payrollTable.status,
      paidAt: payrollTable.paidAt,
      paymentMode: payrollTable.paymentMode,
      transactionRef: payrollTable.transactionRef,
      createdAt: payrollTable.createdAt,
      updatedAt: payrollTable.updatedAt,
      teacherName: usersTable.fullName,
      sessionName: academicSessionsTable.name,
    })
    .from(payrollTable)
    .innerJoin(teachersTable, eq(payrollTable.teacherId, teachersTable.id))
    .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .innerJoin(academicSessionsTable, eq(payrollTable.sessionId, academicSessionsTable.id))
    .where(eq(payrollTable.id, id))
    .limit(1);

  return rows[0] ?? null;
};

const upsertPayroll = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  payload: z.infer<typeof payrollCreateSchema>,
  options?: { defaultPaidAtNow?: boolean },
) => {
  const totals = computeTotals(payload);
  const status = payload.status ?? "pending";
  const parsedPaidAt = toDateOrNull(payload.paidAt);
  const paidAt =
    status === "paid"
      ? parsedPaidAt ?? (options?.defaultPaidAtNow === false ? null : new Date())
      : null;

  const [row] = await tx
    .insert(payrollTable)
    .values({
      teacherId: payload.teacherId,
      sessionId: payload.sessionId,
      month: payload.month,
      year: payload.year,
      basicSalary: payload.basicSalary,
      transportAllowance: payload.transportAllowance,
      otherAllowances: payload.otherAllowances,
      deductions: payload.deductions,
      grossSalary: totals.grossSalary,
      netSalary: totals.netSalary,
      status,
      paidAt,
      paymentMode: status === "paid" ? payload.paymentMode?.trim() || null : null,
      transactionRef: status === "paid" ? payload.transactionRef?.trim() || null : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [payrollTable.teacherId, payrollTable.sessionId, payrollTable.month, payrollTable.year],
      set: {
        basicSalary: payload.basicSalary,
        transportAllowance: payload.transportAllowance,
        otherAllowances: payload.otherAllowances,
        deductions: payload.deductions,
        grossSalary: totals.grossSalary,
        netSalary: totals.netSalary,
        status,
        paidAt,
        paymentMode: status === "paid" ? payload.paymentMode?.trim() || null : null,
        transactionRef: status === "paid" ? payload.transactionRef?.trim() || null : null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: payrollTable.id });

  return row.id;
};

const isTeacherOnlyUser = (roles: string[]) => roles.includes(Role.TEACHER) && !roles.includes(Role.ADMIN);

payrollRouter.get(
  "/all",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const user = c.get("user") as { id: string };
    const roles = (c.get("userRole") as string[]) ?? [];

    const filterSchema = z.object({
      sessionId: uuidSchema.optional(),
      teacherId: uuidSchema.optional(),
      status: z.enum(statusValues).optional(),
      month: monthSchema.optional(),
      year: yearSchema.optional(),
    });

    const parsedFilters = filterSchema.safeParse({
      sessionId: c.req.query("sessionId"),
      teacherId: c.req.query("teacherId"),
      status: c.req.query("status"),
      month: c.req.query("month"),
      year: c.req.query("year"),
    });

    if (!parsedFilters.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid query filters" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const teacherOnly = isTeacherOnlyUser(roles);
      const ownTeacherId = teacherOnly ? await findTeacherByUserId(user.id) : null;

      if (teacherOnly && !ownTeacherId) {
        return c.json<ErrorResponse>(
          { success: false, error: "Teacher profile not found" },
          HttpStatus.NotFound,
        );
      }

      const rows = await db
        .select({
          id: payrollTable.id,
          teacherId: payrollTable.teacherId,
          teacherName: usersTable.fullName,
          sessionId: payrollTable.sessionId,
          sessionName: academicSessionsTable.name,
          month: payrollTable.month,
          year: payrollTable.year,
          basicSalary: payrollTable.basicSalary,
          transportAllowance: payrollTable.transportAllowance,
          otherAllowances: payrollTable.otherAllowances,
          deductions: payrollTable.deductions,
          grossSalary: payrollTable.grossSalary,
          netSalary: payrollTable.netSalary,
          status: payrollTable.status,
          paidAt: payrollTable.paidAt,
          paymentMode: payrollTable.paymentMode,
          transactionRef: payrollTable.transactionRef,
          createdAt: payrollTable.createdAt,
          updatedAt: payrollTable.updatedAt,
        })
        .from(payrollTable)
        .innerJoin(teachersTable, eq(payrollTable.teacherId, teachersTable.id))
        .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
        .innerJoin(academicSessionsTable, eq(payrollTable.sessionId, academicSessionsTable.id))
        .where(
          and(
            parsedFilters.data.sessionId ? eq(payrollTable.sessionId, parsedFilters.data.sessionId) : undefined,
            parsedFilters.data.teacherId ? eq(payrollTable.teacherId, parsedFilters.data.teacherId) : undefined,
            parsedFilters.data.status ? eq(payrollTable.status, parsedFilters.data.status) : undefined,
            parsedFilters.data.month ? eq(payrollTable.month, parsedFilters.data.month) : undefined,
            parsedFilters.data.year ? eq(payrollTable.year, parsedFilters.data.year) : undefined,
            teacherOnly && ownTeacherId ? eq(payrollTable.teacherId, ownTeacherId) : undefined,
          ),
        )
        .orderBy(desc(payrollTable.createdAt));

      return c.json<SuccessResponse>({
        success: true,
        message: "Payroll records retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error retrieving payroll records:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve payroll records" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.get(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const id = c.req.param("id");
    const user = c.get("user") as { id: string };
    const roles = (c.get("userRole") as string[]) ?? [];

    if (!uuidSchema.safeParse(id).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid payroll id" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const row = await getPayrollById(id);
      if (!row) {
        return c.json<ErrorResponse>(
          { success: false, error: "Payroll record not found" },
          HttpStatus.NotFound,
        );
      }

      if (row.status !== "paid") {
        return c.json<ErrorResponse>(
          { success: false, error: "Salary slip is available only for paid payroll" },
          HttpStatus.BadRequest,
        );
      }

      if (isTeacherOnlyUser(roles)) {
        const ownTeacherId = await findTeacherByUserId(user.id);
        if (!ownTeacherId || ownTeacherId !== row.teacherId) {
          return c.json<ErrorResponse>(
            { success: false, error: "Forbidden" },
            HttpStatus.Forbidden,
          );
        }
      }

      return c.json<SuccessResponse>({
        success: true,
        message: "Payroll record retrieved successfully",
        data: row,
      });
    } catch (err) {
      console.error("Error retrieving payroll record:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve payroll record" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.post(
  "/add",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", payrollCreateSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid payroll payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const body = c.req.valid("json");

    try {
      const totals = computeTotals(body);
      const status = body.status ?? "pending";
      const paidAt = status === "paid" ? toDateOrNull(body.paidAt) ?? new Date() : null;

      const [created] = await db
        .insert(payrollTable)
        .values({
          teacherId: body.teacherId,
          sessionId: body.sessionId,
          month: body.month,
          year: body.year,
          basicSalary: body.basicSalary,
          transportAllowance: body.transportAllowance,
          otherAllowances: body.otherAllowances,
          deductions: body.deductions,
          grossSalary: totals.grossSalary,
          netSalary: totals.netSalary,
          status,
          paidAt,
          paymentMode: status === "paid" ? body.paymentMode?.trim() || null : null,
          transactionRef: status === "paid" ? body.transactionRef?.trim() || null : null,
        })
        .returning({ id: payrollTable.id });

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Payroll record created successfully",
          data: { id: created.id },
        },
        HttpStatus.Created,
      );
    } catch (err) {
      console.error("Error creating payroll record:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create payroll record" },
        HttpStatus.InternalServerError,
      );
    }
  },
);
payrollRouter.put(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", payrollUpdateSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid payroll update payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");

    if (!uuidSchema.safeParse(id).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid payroll id" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select()
        .from(payrollTable)
        .where(eq(payrollTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Payroll record not found" },
          HttpStatus.NotFound,
        );
      }

      const current = existing[0];
      const merged = {
        teacherId: body.teacherId ?? current.teacherId,
        sessionId: body.sessionId ?? current.sessionId,
        month: body.month ?? current.month,
        year: body.year ?? current.year,
        basicSalary: body.basicSalary ?? current.basicSalary,
        transportAllowance: body.transportAllowance ?? current.transportAllowance,
        otherAllowances: body.otherAllowances ?? current.otherAllowances,
        deductions: body.deductions ?? current.deductions,
      };

      const totals = computeTotals(merged);
      const status = body.status ?? current.status;
      const paidAt =
        status === "paid"
          ? body.paidAt === null
            ? null
            : toDateOrNull(body.paidAt ?? (current.paidAt ? current.paidAt.toISOString() : undefined)) ?? new Date()
          : null;

      await db
        .update(payrollTable)
        .set({
          ...merged,
          grossSalary: totals.grossSalary,
          netSalary: totals.netSalary,
          status,
          paidAt,
          paymentMode: status === "paid" ? body.paymentMode?.trim() ?? current.paymentMode : null,
          transactionRef: status === "paid" ? body.transactionRef?.trim() ?? current.transactionRef : null,
          updatedAt: new Date(),
        })
        .where(eq(payrollTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Payroll record updated successfully",
      });
    } catch (err) {
      console.error("Error updating payroll record:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update payroll record" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.delete(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    if (!uuidSchema.safeParse(id).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid payroll id" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({ id: payrollTable.id })
        .from(payrollTable)
        .where(eq(payrollTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Payroll record not found" },
          HttpStatus.NotFound,
        );
      }

      await db.delete(payrollTable).where(eq(payrollTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Payroll record deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting payroll record:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete payroll record" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.post(
  "/bulk",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", payrollBulkRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid bulk payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const { records, rollbackOnError } = c.req.valid("json");
    const errors: BulkError[] = [];
    let successCount = 0;

    try {
      await db.transaction(async (tx) => {
        for (let index = 0; index < records.length; index += 1) {
          const parsed = payrollCreateSchema.safeParse(records[index]);

          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            errors.push({
              index,
              error: issue?.message ?? "Invalid record",
              record: records[index],
            });
            if (rollbackOnError) {
              throw new BulkRollbackError("Bulk payroll upsert rolled back");
            }
            continue;
          }

          try {
            await upsertPayroll(tx, parsed.data, { defaultPaidAtNow: false });
            successCount += 1;
          } catch (err) {
            errors.push({
              index,
              error: err instanceof Error ? err.message : "Failed to process record",
              record: records[index],
            });
            if (rollbackOnError) {
              throw new BulkRollbackError("Bulk payroll upsert rolled back");
            }
          }
        }
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Bulk payroll upsert completed",
        data: {
          totalProcessed: records.length,
          successCount,
          failedCount: errors.length,
          errors,
        },
      });
    } catch (err) {
      if (err instanceof BulkRollbackError) {
        return c.json<SuccessResponse>({
          success: true,
          message: "Bulk payroll upsert rolled back due to errors",
          data: {
            totalProcessed: records.length,
            successCount: 0,
            failedCount: errors.length,
            errors,
          },
        });
      }

      console.error("Error in bulk payroll upsert:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to process bulk payroll upsert" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.put(
  "/bulk",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", payrollBulkRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid bulk payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const { records, rollbackOnError } = c.req.valid("json");
    const errors: BulkError[] = [];
    let successCount = 0;

    try {
      await db.transaction(async (tx) => {
        for (let index = 0; index < records.length; index += 1) {
          const parsed = payrollBulkUpdateRecordSchema.safeParse(records[index]);

          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            errors.push({
              index,
              error: issue?.message ?? "Invalid record",
              record: records[index],
            });
            if (rollbackOnError) {
              throw new BulkRollbackError("Bulk payroll update rolled back");
            }
            continue;
          }

          const item = parsed.data;

          try {
            const currentRows = await tx
              .select()
              .from(payrollTable)
              .where(eq(payrollTable.id, item.id))
              .limit(1);
            const current = currentRows[0];

            if (!current) throw new Error("Payroll record not found");

            const merged = {
              teacherId: item.teacherId ?? current.teacherId,
              sessionId: item.sessionId ?? current.sessionId,
              month: item.month ?? current.month,
              year: item.year ?? current.year,
              basicSalary: item.basicSalary ?? current.basicSalary,
              transportAllowance: item.transportAllowance ?? current.transportAllowance,
              otherAllowances: item.otherAllowances ?? current.otherAllowances,
              deductions: item.deductions ?? current.deductions,
            };

            const totals = computeTotals(merged);
            const status = item.status ?? current.status;
            const paidAt =
              status === "paid"
                ? item.paidAt === null
                  ? null
                  : toDateOrNull(item.paidAt ?? (current.paidAt ? current.paidAt.toISOString() : undefined)) ?? new Date()
                : null;

            await tx
              .update(payrollTable)
              .set({
                ...merged,
                grossSalary: totals.grossSalary,
                netSalary: totals.netSalary,
                status,
                paidAt,
                paymentMode: status === "paid" ? item.paymentMode?.trim() ?? current.paymentMode : null,
                transactionRef: status === "paid" ? item.transactionRef?.trim() ?? current.transactionRef : null,
                updatedAt: new Date(),
              })
              .where(eq(payrollTable.id, item.id));

            successCount += 1;
          } catch (err) {
            errors.push({
              index,
              error: err instanceof Error ? err.message : "Failed to process record",
              record: records[index],
            });
            if (rollbackOnError) {
              throw new BulkRollbackError("Bulk payroll update rolled back");
            }
          }
        }
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Bulk payroll update completed",
        data: {
          totalProcessed: records.length,
          successCount,
          failedCount: errors.length,
          errors,
        },
      });
    } catch (err) {
      if (err instanceof BulkRollbackError) {
        return c.json<SuccessResponse>({
          success: true,
          message: "Bulk payroll update rolled back due to errors",
          data: {
            totalProcessed: records.length,
            successCount: 0,
            failedCount: errors.length,
            errors,
          },
        });
      }

      console.error("Error in bulk payroll update:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to process bulk payroll update" },
        HttpStatus.InternalServerError,
      );
    }
  },
);
payrollRouter.post(
  "/pay/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", paySingleSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid payroll payment payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");

    if (!uuidSchema.safeParse(id).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid payroll id" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({ id: payrollTable.id })
        .from(payrollTable)
        .where(eq(payrollTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Payroll record not found" },
          HttpStatus.NotFound,
        );
      }

      await db
        .update(payrollTable)
        .set({
          status: "paid",
          paidAt: toDateOrNull(body.paidAt) ?? new Date(),
          paymentMode: body.paymentMode?.trim() || null,
          transactionRef: body.transactionRef?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(payrollTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Payroll marked as paid successfully",
      });
    } catch (err) {
      console.error("Error paying payroll:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to mark payroll as paid" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.post(
  "/auto-generate",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", autoGenerateSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid auto payroll payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const { sessionId, year, months, overwriteExisting, rollbackOnError } = c.req.valid("json");
    const errors: BulkError[] = [];
    let successCount = 0;
    let skippedCount = 0;

    try {
      const teachers = await getTeachersForAutoPayroll();

      await db.transaction(async (tx) => {
        for (const teacher of teachers) {
          const template = await getLatestPayrollTemplate(tx, teacher.teacherId, sessionId);

          for (const month of months) {
            const existing = await tx
              .select({ id: payrollTable.id, status: payrollTable.status })
              .from(payrollTable)
              .where(
                and(
                  eq(payrollTable.teacherId, teacher.teacherId),
                  eq(payrollTable.sessionId, sessionId),
                  eq(payrollTable.month, month),
                  eq(payrollTable.year, year),
                ),
              )
              .limit(1);

            if (existing.length && !overwriteExisting) {
              skippedCount += 1;
              continue;
            }

            if (existing.length && existing[0].status === "paid") {
              skippedCount += 1;
              continue;
            }

            try {
              await upsertPayroll(tx, {
                teacherId: teacher.teacherId,
                sessionId,
                month,
                year,
                basicSalary: template.basicSalary,
                transportAllowance: template.transportAllowance,
                otherAllowances: template.otherAllowances,
                deductions: template.deductions,
                status: "pending",
              });
              successCount += 1;
            } catch (err) {
              errors.push({
                index: errors.length,
                error: `${teacher.teacherName} (${monthLabel(month)} ${year}): ${err instanceof Error ? err.message : "Failed"}`,
              });
              if (rollbackOnError) {
                throw new BulkRollbackError("Auto payroll generation rolled back");
              }
            }
          }
        }
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Auto payroll generation completed",
        data: {
          sessionId,
          year,
          months,
          totalProcessed: successCount + skippedCount + errors.length,
          successCount,
          skippedCount,
          failedCount: errors.length,
          errors,
        },
      });
    } catch (err) {
      if (err instanceof BulkRollbackError) {
        return c.json<SuccessResponse>({
          success: true,
          message: "Auto payroll generation rolled back due to errors",
          data: {
            sessionId,
            year,
            months,
            totalProcessed: successCount + skippedCount + errors.length,
            successCount: 0,
            skippedCount: 0,
            failedCount: errors.length,
            errors,
          },
        });
      }
      console.error("Error auto generating payroll:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to auto generate payroll" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.post(
  "/pay/bulk",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", payrollBulkRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid bulk payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const { records, rollbackOnError } = c.req.valid("json");
    const errors: BulkError[] = [];
    let successCount = 0;

    try {
      await db.transaction(async (tx) => {
        for (let index = 0; index < records.length; index += 1) {
          const parsed = payBulkRecordSchema.safeParse(records[index]);

          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            errors.push({
              index,
              error: issue?.message ?? "Invalid record",
              record: records[index],
            });
            if (rollbackOnError) {
              throw new BulkRollbackError("Bulk payroll pay operation rolled back");
            }
            continue;
          }

          const item = parsed.data;
          try {
            const existing = await tx
              .select({ id: payrollTable.id })
              .from(payrollTable)
              .where(eq(payrollTable.id, item.id))
              .limit(1);

            if (!existing.length) throw new Error("Payroll record not found");

            await tx
              .update(payrollTable)
              .set({
                status: "paid",
                paidAt: toDateOrNull(item.paidAt) ?? new Date(),
                paymentMode: item.paymentMode?.trim() || null,
                transactionRef: item.transactionRef?.trim() || null,
                updatedAt: new Date(),
              })
              .where(eq(payrollTable.id, item.id));

            successCount += 1;
          } catch (err) {
            errors.push({
              index,
              error: err instanceof Error ? err.message : "Failed to process record",
              record: records[index],
            });
            if (rollbackOnError) {
              throw new BulkRollbackError("Bulk payroll pay operation rolled back");
            }
          }
        }
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Bulk payroll payment completed",
        data: {
          totalProcessed: records.length,
          successCount,
          failedCount: errors.length,
          errors,
        },
      });
    } catch (err) {
      if (err instanceof BulkRollbackError) {
        return c.json<SuccessResponse>({
          success: true,
          message: "Bulk payroll payment rolled back due to errors",
          data: {
            totalProcessed: records.length,
            successCount: 0,
            failedCount: errors.length,
            errors,
          },
        });
      }

      console.error("Error in bulk payroll payment:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to process bulk payroll payment" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.post(
  "/unpay/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");
    if (!uuidSchema.safeParse(id).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid payroll id" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({ id: payrollTable.id })
        .from(payrollTable)
        .where(eq(payrollTable.id, id))
        .limit(1);
      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Payroll record not found" },
          HttpStatus.NotFound,
        );
      }

      await db
        .update(payrollTable)
        .set({
          status: "pending",
          paidAt: null,
          paymentMode: null,
          transactionRef: null,
          updatedAt: new Date(),
        })
        .where(eq(payrollTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Paid status removed successfully",
      });
    } catch (err) {
      console.error("Error removing paid status:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to remove paid status" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.post(
  "/unpay/bulk",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("json", payrollBulkRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid bulk payload" },
        HttpStatus.BadRequest,
      );
    }
  }),
  async (c) => {
    const { records, rollbackOnError } = c.req.valid("json");
    const errors: BulkError[] = [];
    let successCount = 0;

    try {
      await db.transaction(async (tx) => {
        for (let index = 0; index < records.length; index += 1) {
          const parsed = unpayBulkRecordSchema.safeParse(records[index]);
          if (!parsed.success) {
            errors.push({
              index,
              error: parsed.error.issues[0]?.message ?? "Invalid record",
              record: records[index],
            });
            if (rollbackOnError) throw new BulkRollbackError("Bulk unpay rolled back");
            continue;
          }

          const existing = await tx
            .select({ id: payrollTable.id })
            .from(payrollTable)
            .where(eq(payrollTable.id, parsed.data.id))
            .limit(1);
          if (!existing.length) {
            errors.push({ index, error: "Payroll record not found", record: records[index] });
            if (rollbackOnError) throw new BulkRollbackError("Bulk unpay rolled back");
            continue;
          }

          await tx
            .update(payrollTable)
            .set({
              status: "pending",
              paidAt: null,
              paymentMode: null,
              transactionRef: null,
              updatedAt: new Date(),
            })
            .where(eq(payrollTable.id, parsed.data.id));
          successCount += 1;
        }
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Bulk paid status removal completed",
        data: {
          totalProcessed: records.length,
          successCount,
          failedCount: errors.length,
          errors,
        },
      });
    } catch (err) {
      if (err instanceof BulkRollbackError) {
        return c.json<SuccessResponse>({
          success: true,
          message: "Bulk paid status removal rolled back due to errors",
          data: {
            totalProcessed: records.length,
            successCount: 0,
            failedCount: errors.length,
            errors,
          },
        });
      }
      console.error("Error in bulk unpay:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to process bulk paid status removal" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.post(
  "/upload",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const body = await c.req.parseBody({ all: true });
    const rollbackOnErrorValue = typeof body.rollbackOnError === "string" ? body.rollbackOnError : "false";
    const rollbackOnError = rollbackOnErrorValue === "true";
    const file = body.file instanceof File ? body.file : null;

    if (!file) {
      return c.json<ErrorResponse>(
        { success: false, error: "Excel file is required" },
        HttpStatus.BadRequest,
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return c.json<ErrorResponse>(
        { success: false, error: "Only .xlsx files are supported" },
        HttpStatus.BadRequest,
      );
    }

    let records: Array<Record<string, unknown>> = [];
    const errors: BulkError[] = [];
    let successCount = 0;

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        return c.json<ErrorResponse>(
          { success: false, error: "Excel file has no sheets" },
          HttpStatus.BadRequest,
        );
      }

      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        raw: true,
        defval: null,
      });

      const teacherRows = await db
        .select({
          teacherId: teachersTable.id,
          teacherName: usersTable.fullName,
        })
        .from(teachersTable)
        .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id));
      const teacherNameToId = new Map(
        teacherRows.map((row) => [row.teacherName.trim().toLowerCase(), row.teacherId]),
      );

      const sessionRows = await db
        .select({
          sessionId: academicSessionsTable.id,
          sessionName: academicSessionsTable.name,
        })
        .from(academicSessionsTable);
      const sessionNameToId = new Map(
        sessionRows.map((row) => [row.sessionName.trim().toLowerCase(), row.sessionId]),
      );

      records = rawRows.map((rawRow) => {
        const row = buildNormalizedRow(rawRow);
        const teacherIdRaw = getRowValue(row, ["teacherId"]);
        const teacherNameRaw = getRowValue(row, ["teacherName", "teacher"]);
        const sessionIdRaw = getRowValue(row, ["sessionId"]);
        const sessionNameRaw = getRowValue(row, ["sessionName", "session"]);
        const monthRaw = getRowValue(row, ["month", "monthName"]);
        const statusRaw = getRowValue(row, ["status"]);
        const paidAtRaw = getRowValue(row, ["paidAt"]);
        const paidAtParsed = parseDateValue(paidAtRaw);
        const hasPaidAtValue =
          paidAtRaw !== null &&
          paidAtRaw !== undefined &&
          !(typeof paidAtRaw === "string" && paidAtRaw.trim() === "");
        const paidAtInvalid = hasPaidAtValue && !paidAtParsed;

        const teacherId =
          typeof teacherIdRaw === "string" && teacherIdRaw.trim().length
            ? teacherIdRaw.trim()
            : typeof teacherNameRaw === "string"
              ? teacherNameToId.get(teacherNameRaw.trim().toLowerCase()) ?? null
              : null;

        const sessionId =
          typeof sessionIdRaw === "string" && sessionIdRaw.trim().length
            ? sessionIdRaw.trim()
            : typeof sessionNameRaw === "string"
              ? sessionNameToId.get(sessionNameRaw.trim().toLowerCase()) ?? null
              : null;

        return {
          teacherId,
          sessionId,
          month: parseMonthValue(monthRaw),
          year: getRowValue(row, ["year"]),
          basicSalary: parseAmountValue(getRowValue(row, ["basicSalary"])),
          transportAllowance: parseAmountValue(getRowValue(row, ["transportAllowance"])),
          otherAllowances: parseAmountValue(getRowValue(row, ["otherAllowances"])),
          deductions: parseAmountValue(getRowValue(row, ["deductions"])),
          status: parseStatusValue(statusRaw) ?? undefined,
          paidAt: paidAtParsed,
          paidAtInvalid,
          paymentMode: parseTextValue(getRowValue(row, ["paymentMode"])),
          transactionRef: parseTextValue(getRowValue(row, ["transactionRef"])),
        };
      });

      await db.transaction(async (tx) => {
        for (let index = 0; index < records.length; index += 1) {
          if ((records[index] as { paidAtInvalid?: boolean }).paidAtInvalid) {
            errors.push({
              index,
              error: "Invalid paidAt value",
              record: records[index],
            });
            if (rollbackOnError) {
              throw new BulkRollbackError("Payroll upload rolled back");
            }
            continue;
          }

          const parsed = payrollCreateSchema.safeParse(records[index]);

          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            errors.push({
              index,
              error: issue?.message ?? "Invalid row",
              record: records[index],
            });
            if (rollbackOnError) {
              throw new BulkRollbackError("Payroll upload rolled back");
            }
            continue;
          }

          try {
            await upsertPayroll(tx, parsed.data);
            successCount += 1;
          } catch (err) {
            errors.push({
              index,
              error: err instanceof Error ? err.message : "Failed to process row",
              record: records[index],
            });
            if (rollbackOnError) {
              throw new BulkRollbackError("Payroll upload rolled back");
            }
          }
        }
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Payroll Excel upload completed",
        data: {
          totalProcessed: records.length,
          successCount,
          failedCount: errors.length,
          errors,
        },
      });
    } catch (err) {
      if (err instanceof BulkRollbackError) {
        return c.json<SuccessResponse>({
          success: true,
          message: "Payroll Excel upload rolled back due to errors",
          data: {
            totalProcessed: records.length,
            successCount: 0,
            failedCount: errors.length,
            errors,
          },
        });
      }

      console.error("Error uploading payroll Excel:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to process payroll Excel upload" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.get(
  "/download/auto",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const sessionId = c.req.query("sessionId");
    const yearQuery = c.req.query("year");
    const monthsQuery = c.req.query("months");
    const user = c.get("user") as { id: string };
    const roles = (c.get("userRole") as string[]) ?? [];

    if (!sessionId || !uuidSchema.safeParse(sessionId).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Valid sessionId is required" },
        HttpStatus.BadRequest,
      );
    }

    const year = yearQuery ? Number(yearQuery) : undefined;
    if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid year filter" },
        HttpStatus.BadRequest,
      );
    }

    const months =
      monthsQuery?.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 1 && value <= 12) ?? [];

    try {
      const teacherOnly = isTeacherOnlyUser(roles);
      const ownTeacherId = teacherOnly ? await findTeacherByUserId(user.id) : null;
      if (teacherOnly && !ownTeacherId) {
        return c.json<ErrorResponse>(
          { success: false, error: "Teacher profile not found" },
          HttpStatus.NotFound,
        );
      }

      const rows = await db
        .select({
          teacherId: payrollTable.teacherId,
          sessionId: payrollTable.sessionId,
          teacherName: usersTable.fullName,
          sessionName: academicSessionsTable.name,
          month: payrollTable.month,
          year: payrollTable.year,
          basicSalary: payrollTable.basicSalary,
          transportAllowance: payrollTable.transportAllowance,
          otherAllowances: payrollTable.otherAllowances,
          deductions: payrollTable.deductions,
          grossSalary: payrollTable.grossSalary,
          netSalary: payrollTable.netSalary,
          status: payrollTable.status,
          paidAt: payrollTable.paidAt,
          paymentMode: payrollTable.paymentMode,
          transactionRef: payrollTable.transactionRef,
        })
        .from(payrollTable)
        .innerJoin(teachersTable, eq(payrollTable.teacherId, teachersTable.id))
        .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
        .innerJoin(academicSessionsTable, eq(payrollTable.sessionId, academicSessionsTable.id))
        .where(
          and(
            eq(payrollTable.sessionId, sessionId),
            year !== undefined ? eq(payrollTable.year, year) : undefined,
            months.length ? inArray(payrollTable.month, months) : undefined,
            teacherOnly && ownTeacherId ? eq(payrollTable.teacherId, ownTeacherId) : undefined,
          ),
        )
        .orderBy(asc(usersTable.fullName), asc(payrollTable.year), asc(payrollTable.month));

      const workbook = XLSX.utils.book_new();
      const worksheetData = rows.map((row) => ({
        teacherId: row.teacherId,
        sessionId: row.sessionId,
        teacherName: row.teacherName,
        sessionName: row.sessionName,
        month: row.month,
        monthName: monthLabel(row.month),
        year: row.year,
        basicSalary: row.basicSalary,
        transportAllowance: row.transportAllowance,
        otherAllowances: row.otherAllowances,
        deductions: row.deductions,
        grossSalary: row.grossSalary,
        netSalary: row.netSalary,
        status: row.status,
        paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : "",
        paymentMode: row.paymentMode ?? "",
        transactionRef: row.transactionRef ?? "",
      }));
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");
      const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

      return new Response(fileBuffer.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="payroll-auto-${sessionId}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      console.error("Error downloading auto payroll data:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to download auto payroll data" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

payrollRouter.get(
  "/download/slip/:id",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const id = c.req.param("id");
    const user = c.get("user") as { id: string };
    const roles = (c.get("userRole") as string[]) ?? [];

    if (!uuidSchema.safeParse(id).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid payroll id" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const row = await getPayrollById(id);
      if (!row) {
        return c.json<ErrorResponse>(
          { success: false, error: "Payroll record not found" },
          HttpStatus.NotFound,
        );
      }

      if (isTeacherOnlyUser(roles)) {
        const ownTeacherId = await findTeacherByUserId(user.id);
        if (!ownTeacherId || ownTeacherId !== row.teacherId) {
          return c.json<ErrorResponse>(
            { success: false, error: "Forbidden" },
            HttpStatus.Forbidden,
          );
        }
      }

      const doc = await PDFDocument.create();
      const regularFont = await doc.embedFont(StandardFonts.Helvetica);
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
      const page = doc.addPage([595.28, 841.89]);

      const money = (value: number) => `INR ${value.toLocaleString("en-IN")}`;

      const drawRow = (label: string, value: string, y: number) => {
        page.drawText(label, { x: 52, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(value, { x: 250, y, size: 11, font: regularFont, color: rgb(0.15, 0.15, 0.15) });
      };

      page.drawRectangle({
        x: 40,
        y: 730,
        width: 510,
        height: 95,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1.5,
      });
      page.drawRectangle({
        x: 44,
        y: 744,
        width: 70,
        height: 70,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
      page.drawText("LOGO", { x: 66, y: 778, size: 10, font: boldFont });

      page.drawText("H.B.R. ENGLISH MEDIUM SCHOOL BILHA", {
        x: 122,
        y: 802,
        size: 14,
        font: boldFont,
      });
      page.drawText("DIST-BILASPUR (C.G.)", { x: 122, y: 785, size: 12, font: boldFont });
      page.drawText("Affiliated to: C.G. BOARD RAIPUR (312278)", {
        x: 122,
        y: 770,
        size: 9,
        font: regularFont,
      });
      page.drawText("UDISE NO.: 22070321207 | Email: hbrschoolbilha@gmail.com", {
        x: 122,
        y: 757,
        size: 9,
        font: regularFont,
      });
      page.drawText("PAYROLL SHEET", { x: 235, y: 736, size: 12, font: boldFont });

      drawRow("Teacher", row.teacherName, 700);
      drawRow("Academic Session", row.sessionName, 676);
      drawRow("Payroll Month", `${monthLabel(row.month)} ${row.year}`, 652);
      drawRow("Status", row.status, 628);
      drawRow("Basic Salary", money(row.basicSalary), 596);
      drawRow("Transport Allowance", money(row.transportAllowance), 572);
      drawRow("Other Allowances", money(row.otherAllowances), 548);
      drawRow("Deductions", money(row.deductions), 524);
      drawRow("Gross Salary", money(row.grossSalary), 500);
      drawRow("Net Salary", money(row.netSalary), 476);
      drawRow("Paid At", row.paidAt ? new Date(row.paidAt).toLocaleDateString() : "-", 444);
      drawRow("Payment Mode", row.paymentMode ?? "-", 420);
      drawRow("Transaction Ref", row.transactionRef ?? "-", 396);

      page.drawText("Generated by School Management System", {
        x: 52,
        y: 90,
        size: 10,
        font: regularFont,
        color: rgb(0.45, 0.45, 0.45),
      });

      const pdfBytes = await doc.save();
      const fileName = `salary-slip-${row.teacherName.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

      return new Response(pdfBytes.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      console.error("Error generating salary slip:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to generate salary slip" },
        HttpStatus.InternalServerError,
      );
    }
  },
);
payrollRouter.get(
  "/report/:sessionId",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const sessionId = c.req.param("sessionId");
    const monthQuery = c.req.query("month");
    const yearQuery = c.req.query("year");
    const user = c.get("user") as { id: string };
    const roles = (c.get("userRole") as string[]) ?? [];

    if (!uuidSchema.safeParse(sessionId).success) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid session id" },
        HttpStatus.BadRequest,
      );
    }

    const month = monthQuery ? Number(monthQuery) : undefined;
    const year = yearQuery ? Number(yearQuery) : undefined;
    if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid month filter" },
        HttpStatus.BadRequest,
      );
    }
    if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
      return c.json<ErrorResponse>(
        { success: false, error: "Invalid year filter" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const teacherOnly = isTeacherOnlyUser(roles);
      const ownTeacherId = teacherOnly ? await findTeacherByUserId(user.id) : null;

      if (teacherOnly && !ownTeacherId) {
        return c.json<ErrorResponse>(
          { success: false, error: "Teacher profile not found" },
          HttpStatus.NotFound,
        );
      }

      const rows = await db
        .select({
          id: payrollTable.id,
          teacherId: payrollTable.teacherId,
          teacherName: usersTable.fullName,
          sessionId: payrollTable.sessionId,
          sessionName: academicSessionsTable.name,
          month: payrollTable.month,
          year: payrollTable.year,
          basicSalary: payrollTable.basicSalary,
          transportAllowance: payrollTable.transportAllowance,
          otherAllowances: payrollTable.otherAllowances,
          deductions: payrollTable.deductions,
          grossSalary: payrollTable.grossSalary,
          netSalary: payrollTable.netSalary,
          status: payrollTable.status,
          paidAt: payrollTable.paidAt,
          paymentMode: payrollTable.paymentMode,
          transactionRef: payrollTable.transactionRef,
        })
        .from(payrollTable)
        .innerJoin(teachersTable, eq(payrollTable.teacherId, teachersTable.id))
        .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
        .innerJoin(academicSessionsTable, eq(payrollTable.sessionId, academicSessionsTable.id))
        .where(
          and(
            eq(payrollTable.sessionId, sessionId),
            month !== undefined ? eq(payrollTable.month, month) : undefined,
            year !== undefined ? eq(payrollTable.year, year) : undefined,
            teacherOnly && ownTeacherId ? eq(payrollTable.teacherId, ownTeacherId) : undefined,
          ),
        )
        .orderBy(desc(payrollTable.createdAt));

      return c.json<SuccessResponse>({
        success: true,
        message: "Payroll report retrieved successfully",
        data: {
          sessionId,
          rows,
          summary: {
            totalRecords: rows.length,
            paidCount: rows.filter((row) => row.status === "paid").length,
            pendingCount: rows.filter((row) => row.status === "pending").length,
            totalGross: rows.reduce((sum, row) => sum + row.grossSalary, 0),
            totalNet: rows.reduce((sum, row) => sum + row.netSalary, 0),
          },
        },
      });
    } catch (err) {
      console.error("Error retrieving payroll report:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve payroll report" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default payrollRouter;
