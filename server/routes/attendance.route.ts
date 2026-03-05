import { Hono } from "hono";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import {
  attendanceFeatureConfigTable,
  attendanceSchedulesTable,
  teacherAttendanceTable,
} from "../db/schemas/attendance";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { HttpStatus, type ErrorResponse, type SuccessResponse } from "../utils/types";
import { Role } from "../utils/roles";
import { teachersTable } from "../db/schemas/teachers";
import { usersTable } from "../db/schemas/users";

const attendanceRouter = new Hono();

const DEFAULT_DURATION_MINUTES = 60;
const IST_TIMEZONE = "Asia/Kolkata";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toISTDate = (value: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
  }).format(value);

const parseIsoDateTime = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const parseISTDateAndTime = (dateValue: unknown, timeValue: unknown) => {
  if (typeof dateValue !== "string" || typeof timeValue !== "string") return null;
  const date = dateValue.trim();
  const time = timeValue.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;

  const parsed = new Date(`${date}T${time}:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const enumerateDateRange = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00+05:30`);
  const end = new Date(`${endDate}T00:00:00+05:30`);
  while (current.getTime() <= end.getTime()) {
    const iso = new Date(current.getTime()).toISOString().slice(0, 10);
    dates.push(iso);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
};

const calculateDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
};

const getOrCreateAttendanceConfig = async (client: any) => {
  const existing = await client
    .select()
    .from(attendanceFeatureConfigTable)
    .orderBy(desc(attendanceFeatureConfigTable.createdAt))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [created] = await client
    .insert(attendanceFeatureConfigTable)
    .values({
      allowedRadiusMeters: 150,
      autoDisableMinutes: DEFAULT_DURATION_MINUTES,
      isFeatureEnabled: false,
      isFutureScheduleEnabled: true,
    })
    .returning();

  return created;
};

const applyAutomationAndReturnConfig = async () => {
  return db.transaction(async (tx) => {
    let config = await getOrCreateAttendanceConfig(tx);
    const now = new Date();

    if (config.isFutureScheduleEnabled) {
      const dueSchedules = await tx
        .select()
        .from(attendanceSchedulesTable)
        .where(
          and(
            eq(attendanceSchedulesTable.isProcessed, false),
            lte(attendanceSchedulesTable.triggerAt, now),
          ),
        )
        .orderBy(asc(attendanceSchedulesTable.triggerAt));

      for (const schedule of dueSchedules) {
        if (schedule.action === "on") {
          const startsAt = schedule.triggerAt;
          const effectiveDuration =
            schedule.durationMinutes ?? config.autoDisableMinutes;
          const activeUntil =
            effectiveDuration > 0
              ? new Date(startsAt.getTime() + effectiveDuration * 60 * 1000)
              : null;

          await tx
            .update(attendanceFeatureConfigTable)
            .set({
              isFeatureEnabled: true,
              enabledAt: startsAt,
              activeUntil,
            })
            .where(eq(attendanceFeatureConfigTable.id, config.id));
        } else {
          await tx
            .update(attendanceFeatureConfigTable)
            .set({
              isFeatureEnabled: false,
              enabledAt: null,
              activeUntil: null,
            })
            .where(eq(attendanceFeatureConfigTable.id, config.id));
        }

        await tx
          .update(attendanceSchedulesTable)
          .set({
            isProcessed: true,
            processedAt: now,
          })
          .where(eq(attendanceSchedulesTable.id, schedule.id));
      }

      if (dueSchedules.length > 0) {
        const latest = await tx
          .select()
          .from(attendanceFeatureConfigTable)
          .where(eq(attendanceFeatureConfigTable.id, config.id))
          .limit(1);
        if (latest.length > 0) {
          config = latest[0];
        }
      }
    }

    if (
      config.isFeatureEnabled &&
      config.activeUntil &&
      config.activeUntil.getTime() <= now.getTime()
    ) {
      const [disabled] = await tx
        .update(attendanceFeatureConfigTable)
        .set({
          isFeatureEnabled: false,
          enabledAt: null,
          activeUntil: null,
        })
        .where(eq(attendanceFeatureConfigTable.id, config.id))
        .returning();

      config = disabled;
    }

    return config;
  });
};

attendanceRouter.get(
  "/config",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const config = await applyAutomationAndReturnConfig();

    return c.json<SuccessResponse>({
      success: true,
      message: "Attendance configuration retrieved successfully",
      data: config,
    });
  },
);

attendanceRouter.put(
  "/config",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));

    const schoolLatitude =
      typeof body.schoolLatitude === "number" ? body.schoolLatitude : null;
    const schoolLongitude =
      typeof body.schoolLongitude === "number" ? body.schoolLongitude : null;
    const allowedRadiusMeters =
      typeof body.allowedRadiusMeters === "number"
        ? Math.round(body.allowedRadiusMeters)
        : null;
    const autoDisableMinutes =
      typeof body.autoDisableMinutes === "number"
        ? Math.round(body.autoDisableMinutes)
        : null;
    const isFutureScheduleEnabled =
      typeof body.isFutureScheduleEnabled === "boolean"
        ? body.isFutureScheduleEnabled
        : null;

    if (
      schoolLatitude !== null &&
      (!isFiniteNumber(schoolLatitude) || schoolLatitude < -90 || schoolLatitude > 90)
    ) {
      return c.json<ErrorResponse>(
        { success: false, error: "School latitude must be between -90 and 90" },
        HttpStatus.BadRequest,
      );
    }

    if (
      schoolLongitude !== null &&
      (!isFiniteNumber(schoolLongitude) || schoolLongitude < -180 || schoolLongitude > 180)
    ) {
      return c.json<ErrorResponse>(
        { success: false, error: "School longitude must be between -180 and 180" },
        HttpStatus.BadRequest,
      );
    }

    if (
      allowedRadiusMeters !== null &&
      (!Number.isInteger(allowedRadiusMeters) ||
        allowedRadiusMeters < 20 ||
        allowedRadiusMeters > 5000)
    ) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Allowed radius must be an integer between 20 and 5000 meters",
        },
        HttpStatus.BadRequest,
      );
    }

    if (
      autoDisableMinutes !== null &&
      (!Number.isInteger(autoDisableMinutes) ||
        autoDisableMinutes < 0 ||
        autoDisableMinutes > 1440)
    ) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Auto disable minutes must be an integer between 0 and 1440",
        },
        HttpStatus.BadRequest,
      );
    }

    const config = await db.transaction(async (tx) => {
      const existing = await getOrCreateAttendanceConfig(tx);
      const [updated] = await tx
        .update(attendanceFeatureConfigTable)
        .set({
          schoolLatitude,
          schoolLongitude,
          allowedRadiusMeters: allowedRadiusMeters ?? existing.allowedRadiusMeters,
          autoDisableMinutes: autoDisableMinutes ?? existing.autoDisableMinutes,
          isFutureScheduleEnabled:
            isFutureScheduleEnabled ?? existing.isFutureScheduleEnabled,
          updatedByUserId: user.id,
        })
        .where(eq(attendanceFeatureConfigTable.id, existing.id))
        .returning();

      return updated;
    });

    return c.json<SuccessResponse>({
      success: true,
      message: "Attendance configuration updated successfully",
      data: config,
    });
  },
);

attendanceRouter.post(
  "/feature-toggle",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const enabled = body?.enabled;

    if (typeof enabled !== "boolean") {
      return c.json<ErrorResponse>(
        { success: false, error: "enabled must be a boolean" },
        HttpStatus.BadRequest,
      );
    }

    const now = new Date();
    const config = await db.transaction(async (tx) => {
      const existing = await getOrCreateAttendanceConfig(tx);
      const activeUntil =
        enabled && existing.autoDisableMinutes > 0
          ? new Date(now.getTime() + existing.autoDisableMinutes * 60 * 1000)
          : null;
      const [updated] = await tx
        .update(attendanceFeatureConfigTable)
        .set({
          isFeatureEnabled: enabled,
          enabledAt: enabled ? now : null,
          activeUntil: enabled ? activeUntil : null,
          updatedByUserId: user.id,
        })
        .where(eq(attendanceFeatureConfigTable.id, existing.id))
        .returning();

      return updated;
    });

    return c.json<SuccessResponse>({
      success: true,
      message: enabled ? "Attendance feature enabled" : "Attendance feature disabled",
      data: config,
    });
  },
);

attendanceRouter.post(
  "/manual-mark",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const adminUser = c.get("user");
    const body = await c.req.json().catch(() => ({}));

    const teacherId =
      typeof body.teacherId === "string" ? body.teacherId.trim() : "";
    const remarks = typeof body.remarks === "string" ? body.remarks.trim() : null;
    const checkInAt = parseIsoDateTime(body.checkInAt) ?? new Date();
    const attendanceDate =
      typeof body.attendanceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.attendanceDate)
        ? body.attendanceDate
        : toISTDate(checkInAt);

    if (!teacherId) {
      return c.json<ErrorResponse>(
        { success: false, error: "teacherId is required" },
        HttpStatus.BadRequest,
      );
    }

    const teacher = await db
      .select({
        id: teachersTable.id,
        userId: teachersTable.userId,
      })
      .from(teachersTable)
      .where(eq(teachersTable.id, teacherId))
      .limit(1);

    if (teacher.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Teacher not found" },
        HttpStatus.NotFound,
      );
    }

    const existing = await db
      .select({ id: teacherAttendanceTable.id })
      .from(teacherAttendanceTable)
      .where(
        and(
          eq(teacherAttendanceTable.teacherId, teacherId),
          eq(teacherAttendanceTable.attendanceDate, attendanceDate),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: `Attendance already marked for ${attendanceDate}`,
        },
        HttpStatus.Conflict,
      );
    }

    const [record] = await db
      .insert(teacherAttendanceTable)
      .values({
        teacherId: teacher[0].id,
        userId: teacher[0].userId,
        attendanceDate,
        checkInAt,
        status: "present",
        method: "manual",
        markedByUserId: adminUser.id,
        remarks: remarks || null,
      })
      .returning();

    return c.json<SuccessResponse>({
      success: true,
      message: "Attendance marked manually",
      data: record,
    });
  },
);

attendanceRouter.post(
  "/auto-check-in",
  requireAuth,
  requireRoles([Role.TEACHER]),
  async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));

    const latitude = body?.latitude;
    const longitude = body?.longitude;

    if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
      return c.json<ErrorResponse>(
        { success: false, error: "Valid latitude and longitude are required" },
        HttpStatus.BadRequest,
      );
    }

    const teacher = await db
      .select({
        id: teachersTable.id,
        userId: teachersTable.userId,
      })
      .from(teachersTable)
      .where(eq(teachersTable.userId, user.id))
      .limit(1);

    if (teacher.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Teacher profile not found" },
        HttpStatus.NotFound,
      );
    }

    const config = await applyAutomationAndReturnConfig();

    if (!config.isFeatureEnabled) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Attendance feature is currently disabled",
        },
        HttpStatus.BadRequest,
      );
    }

    if (
      !isFiniteNumber(config.schoolLatitude) ||
      !isFiniteNumber(config.schoolLongitude)
    ) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "School location is not configured by admin",
        },
        HttpStatus.BadRequest,
      );
    }

    const distanceMeters = calculateDistanceMeters(
      latitude,
      longitude,
      config.schoolLatitude,
      config.schoolLongitude,
    );

    if (distanceMeters > config.allowedRadiusMeters) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: `You are outside allowed range. Current distance: ${distanceMeters}m`,
        },
        HttpStatus.BadRequest,
      );
    }

    const checkInAt = new Date();
    const attendanceDate = toISTDate(checkInAt);

    const existing = await db
      .select()
      .from(teacherAttendanceTable)
      .where(
        and(
          eq(teacherAttendanceTable.teacherId, teacher[0].id),
          eq(teacherAttendanceTable.attendanceDate, attendanceDate),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return c.json<SuccessResponse>({
        success: true,
        message: "Attendance already marked for today",
        data: existing[0],
      });
    }

    const [record] = await db
      .insert(teacherAttendanceTable)
      .values({
        teacherId: teacher[0].id,
        userId: teacher[0].userId,
        attendanceDate,
        checkInAt,
        status: "present",
        method: "auto",
        latitude,
        longitude,
        distanceMeters,
      })
      .returning();

    return c.json<SuccessResponse>({
      success: true,
      message: "Attendance marked successfully",
      data: record,
    });
  },
);

attendanceRouter.get(
  "/my-attendance",
  requireAuth,
  requireRoles([Role.TEACHER]),
  async (c) => {
    const user = c.get("user");
    const fromDate = c.req.query("fromDate")?.trim();
    const toDate = c.req.query("toDate")?.trim();

    const teacher = await db
      .select({ id: teachersTable.id })
      .from(teachersTable)
      .where(eq(teachersTable.userId, user.id))
      .limit(1);

    if (teacher.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Teacher profile not found" },
        HttpStatus.NotFound,
      );
    }

    const whereClauses = [eq(teacherAttendanceTable.teacherId, teacher[0].id)];

    if (fromDate) {
      whereClauses.push(gte(teacherAttendanceTable.attendanceDate, fromDate));
    }
    if (toDate) {
      whereClauses.push(lte(teacherAttendanceTable.attendanceDate, toDate));
    }

    const records = await db
      .select()
      .from(teacherAttendanceTable)
      .where(and(...whereClauses))
      .orderBy(desc(teacherAttendanceTable.attendanceDate));

    return c.json<SuccessResponse>({
      success: true,
      message: "Attendance records retrieved successfully",
      data: records,
    });
  },
);

attendanceRouter.get(
  "/teachers",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const teachers = await db
      .select({
        id: teachersTable.id,
        userId: teachersTable.userId,
        fullName: usersTable.fullName,
        username: usersTable.username,
      })
      .from(teachersTable)
      .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .orderBy(asc(usersTable.fullName));

    return c.json<SuccessResponse>({
      success: true,
      message: "Teachers retrieved successfully",
      data: teachers,
    });
  },
);

attendanceRouter.get(
  "/records",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const fromDate = c.req.query("fromDate")?.trim();
    const toDate = c.req.query("toDate")?.trim();
    const teacherId = c.req.query("teacherId")?.trim();

    const whereClauses = [];

    if (teacherId) {
      whereClauses.push(eq(teacherAttendanceTable.teacherId, teacherId));
    }
    if (fromDate) {
      whereClauses.push(gte(teacherAttendanceTable.attendanceDate, fromDate));
    }
    if (toDate) {
      whereClauses.push(lte(teacherAttendanceTable.attendanceDate, toDate));
    }

    const records = await db
      .select({
        id: teacherAttendanceTable.id,
        teacherId: teacherAttendanceTable.teacherId,
        attendanceDate: teacherAttendanceTable.attendanceDate,
        checkInAt: teacherAttendanceTable.checkInAt,
        method: teacherAttendanceTable.method,
        status: teacherAttendanceTable.status,
        distanceMeters: teacherAttendanceTable.distanceMeters,
        remarks: teacherAttendanceTable.remarks,
        teacherName: usersTable.fullName,
        teacherUsername: usersTable.username,
      })
      .from(teacherAttendanceTable)
      .innerJoin(teachersTable, eq(teacherAttendanceTable.teacherId, teachersTable.id))
      .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
      .orderBy(
        desc(teacherAttendanceTable.attendanceDate),
        desc(teacherAttendanceTable.checkInAt),
      );

    return c.json<SuccessResponse>({
      success: true,
      message: "Attendance records retrieved successfully",
      data: records,
    });
  },
);

attendanceRouter.patch(
  "/records/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const user = c.get("user");
    const recordId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));

    const existing = await db
      .select({
        id: teacherAttendanceTable.id,
        teacherId: teacherAttendanceTable.teacherId,
      })
      .from(teacherAttendanceTable)
      .where(eq(teacherAttendanceTable.id, recordId))
      .limit(1);

    if (existing.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Attendance record not found" },
        HttpStatus.NotFound,
      );
    }

    const nextAttendanceDate =
      typeof body.attendanceDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.attendanceDate)
        ? body.attendanceDate
        : null;
    const nextCheckInAt =
      body.checkInAt === undefined ? undefined : parseIsoDateTime(body.checkInAt);
    const nextMethod =
      typeof body.method === "string" ? body.method.trim().toLowerCase() : undefined;
    const nextRemarks =
      body.remarks === undefined
        ? undefined
        : body.remarks === null
          ? null
          : typeof body.remarks === "string"
            ? body.remarks.trim()
            : undefined;
    const nextStatus =
      typeof body.status === "string" ? body.status.trim().toLowerCase() : undefined;

    if (body.attendanceDate !== undefined && nextAttendanceDate === null) {
      return c.json<ErrorResponse>(
        { success: false, error: "attendanceDate must be in YYYY-MM-DD format" },
        HttpStatus.BadRequest,
      );
    }

    if (body.checkInAt !== undefined && !nextCheckInAt) {
      return c.json<ErrorResponse>(
        { success: false, error: "checkInAt must be a valid datetime string" },
        HttpStatus.BadRequest,
      );
    }

    if (nextMethod !== undefined && nextMethod !== "auto" && nextMethod !== "manual") {
      return c.json<ErrorResponse>(
        { success: false, error: "method must be either auto or manual" },
        HttpStatus.BadRequest,
      );
    }

    if (nextRemarks !== undefined && nextRemarks !== null && nextRemarks.length > 255) {
      return c.json<ErrorResponse>(
        { success: false, error: "remarks cannot exceed 255 characters" },
        HttpStatus.BadRequest,
      );
    }

    if (nextStatus !== undefined && nextStatus.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "status cannot be empty" },
        HttpStatus.BadRequest,
      );
    }

    if (nextAttendanceDate) {
      const duplicate = await db
        .select({ id: teacherAttendanceTable.id })
        .from(teacherAttendanceTable)
        .where(
          and(
            eq(teacherAttendanceTable.teacherId, existing[0].teacherId),
            eq(teacherAttendanceTable.attendanceDate, nextAttendanceDate),
          ),
        )
        .limit(1);

      if (duplicate.length > 0 && duplicate[0].id !== recordId) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error: `Attendance already exists for ${nextAttendanceDate}`,
          },
          HttpStatus.Conflict,
        );
      }
    }

    const valuesToUpdate: Partial<typeof teacherAttendanceTable.$inferInsert> = {
      markedByUserId: user.id,
    };

    let hasUpdatableField = false;

    if (nextAttendanceDate) {
      valuesToUpdate.attendanceDate = nextAttendanceDate;
      hasUpdatableField = true;
    }
    if (nextCheckInAt) {
      valuesToUpdate.checkInAt = nextCheckInAt;
      hasUpdatableField = true;
    }
    if (nextMethod !== undefined) {
      valuesToUpdate.method = nextMethod;
      hasUpdatableField = true;
    }
    if (nextRemarks !== undefined) {
      valuesToUpdate.remarks = nextRemarks || null;
      hasUpdatableField = true;
    }
    if (nextStatus !== undefined) {
      valuesToUpdate.status = nextStatus;
      hasUpdatableField = true;
    }

    if (!hasUpdatableField) {
      return c.json<ErrorResponse>(
        { success: false, error: "No valid fields provided to update" },
        HttpStatus.BadRequest,
      );
    }

    const [updated] = await db
      .update(teacherAttendanceTable)
      .set(valuesToUpdate)
      .where(eq(teacherAttendanceTable.id, recordId))
      .returning();

    return c.json<SuccessResponse>({
      success: true,
      message: "Attendance record updated successfully",
      data: updated,
    });
  },
);

attendanceRouter.delete(
  "/records/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const recordId = c.req.param("id");

    const existing = await db
      .select({ id: teacherAttendanceTable.id })
      .from(teacherAttendanceTable)
      .where(eq(teacherAttendanceTable.id, recordId))
      .limit(1);

    if (existing.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Attendance record not found" },
        HttpStatus.NotFound,
      );
    }

    await db
      .delete(teacherAttendanceTable)
      .where(eq(teacherAttendanceTable.id, recordId));

    return c.json<SuccessResponse>({
      success: true,
      message: "Attendance record deleted successfully",
    });
  },
);

attendanceRouter.post(
  "/schedules",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));

    const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
    const triggerAt = parseIsoDateTime(body.triggerAt);
    const startDate =
      typeof body.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
        ? body.startDate
        : null;
    const endDate =
      typeof body.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.endDate)
        ? body.endDate
        : null;
    const time = typeof body.time === "string" ? body.time.trim() : null;
    const note = typeof body.note === "string" ? body.note.trim() : null;

    if (action !== "on" && action !== "off") {
      return c.json<ErrorResponse>(
        { success: false, error: "action must be either on or off" },
        HttpStatus.BadRequest,
      );
    }

    const hasRangeInput = !!startDate || !!endDate || !!time;
    if (!triggerAt && !hasRangeInput) {
      return c.json<ErrorResponse>(
        { success: false, error: "Provide triggerAt or startDate, endDate and time" },
        HttpStatus.BadRequest,
      );
    }

    if (triggerAt && triggerAt.getTime() <= Date.now()) {
      return c.json<ErrorResponse>(
        { success: false, error: "triggerAt must be in the future" },
        HttpStatus.BadRequest,
      );
    }

    if (hasRangeInput) {
      if (!startDate || !endDate || !time) {
        return c.json<ErrorResponse>(
          { success: false, error: "startDate, endDate and time are required for date range" },
          HttpStatus.BadRequest,
        );
      }
      if (endDate < startDate) {
        return c.json<ErrorResponse>(
          { success: false, error: "endDate must be after or equal to startDate" },
          HttpStatus.BadRequest,
        );
      }

      const dates = enumerateDateRange(startDate, endDate);
      const rows = dates
        .map((date) => ({
          date,
          triggerAt: parseISTDateAndTime(date, time),
        }))
        .filter((row): row is { date: string; triggerAt: Date } => !!row.triggerAt)
        .filter((row) => row.triggerAt.getTime() > Date.now());

      if (rows.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "No future schedule slots found in selected date range" },
          HttpStatus.BadRequest,
        );
      }

      const schedules = await db
        .insert(attendanceSchedulesTable)
        .values(
          rows.map((row) => ({
            action,
            triggerAt: row.triggerAt,
            durationMinutes: null,
            note: note || null,
            createdByUserId: user.id,
          })),
        )
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: `${schedules.length} attendance automation schedules created`,
        data: schedules,
      });
    }

    const [schedule] = await db
      .insert(attendanceSchedulesTable)
      .values({
        action,
        triggerAt: triggerAt as Date,
        durationMinutes: null,
        note: note || null,
        createdByUserId: user.id,
      })
      .returning();

    return c.json<SuccessResponse>({
      success: true,
      message: "Attendance automation schedule created",
      data: schedule,
    });
  },
);

attendanceRouter.get(
  "/schedules",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const schedules = await db
      .select()
      .from(attendanceSchedulesTable)
      .where(eq(attendanceSchedulesTable.isProcessed, false))
      .orderBy(asc(attendanceSchedulesTable.triggerAt));

    return c.json<SuccessResponse>({
      success: true,
      message: "Attendance schedules retrieved successfully",
      data: schedules,
    });
  },
);

attendanceRouter.delete(
  "/schedules/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const scheduleId = c.req.param("id");

    const existing = await db
      .select({ id: attendanceSchedulesTable.id })
      .from(attendanceSchedulesTable)
      .where(eq(attendanceSchedulesTable.id, scheduleId))
      .limit(1);

    if (existing.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Schedule not found" },
        HttpStatus.NotFound,
      );
    }

    await db
      .delete(attendanceSchedulesTable)
      .where(eq(attendanceSchedulesTable.id, scheduleId));

    return c.json<SuccessResponse>({
      success: true,
      message: "Schedule deleted successfully",
    });
  },
);

export default attendanceRouter;
