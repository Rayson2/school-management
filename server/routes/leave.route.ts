import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { HttpStatus, type ErrorResponse, type SuccessResponse } from "../utils/types";
import { Role } from "../utils/roles";
import { leaveRequestsTable, leaveStatusEnum } from "../db/schemas/leaves";
import { usersTable } from "../db/schemas/users";
import { studentsTable } from "../db/schemas/students";
import { teachersTable } from "../db/schemas/teachers";
import { classesTable } from "../db/schemas/classes";

const leaveRouter = new Hono();

const leaveTypeOptions = ["Sick", "Casual", "Emergency", "Personal", "Other"] as const;
const leaveStatusOptions = [...leaveStatusEnum.enumValues] as const;
const STUDENT_MAX_LEAVE_DAYS = 15;

const parseDateOnly = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const parsed = new Date(`${value}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const calculateInclusiveDays = (startDate: Date, endDate: Date) => {
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
};

leaveRouter.get(
  "/options",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER, Role.STUDENT]),
  async (c) => {
    const userRoles = (c.get("userRole") ?? []) as string[];
    const applicantRole = userRoles.includes(Role.TEACHER)
      ? Role.TEACHER
      : userRoles.includes(Role.STUDENT)
        ? Role.STUDENT
        : null;

    return c.json<SuccessResponse>({
      success: true,
      message: "Leave options retrieved successfully",
      data: {
        leaveTypes: [...leaveTypeOptions],
        statuses: [...leaveStatusOptions],
        applicantRole,
        studentMaxDays: STUDENT_MAX_LEAVE_DAYS,
      },
    });
  },
);

leaveRouter.post(
  "/apply",
  requireAuth,
  requireRoles([Role.TEACHER, Role.STUDENT]),
  async (c) => {
    const user = c.get("user");
    const userRoles = (c.get("userRole") ?? []) as string[];
    const body = await c.req.json().catch(() => ({}));
    const payload = typeof body === "object" && body !== null ? body : {};

    const applicantRole = userRoles.includes(Role.TEACHER) ? Role.TEACHER : Role.STUDENT;
    const leaveType =
      typeof payload.leaveType === "string" ? payload.leaveType.trim() : "";
    const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
    const startDate = parseDateOnly(payload.startDate);
    const endDate = parseDateOnly(payload.endDate);

    if (!leaveType || !leaveTypeOptions.includes(leaveType as (typeof leaveTypeOptions)[number])) {
      return c.json<ErrorResponse>(
        { success: false, error: "Please select a valid leave type" },
        HttpStatus.BadRequest,
      );
    }

    if (!startDate || !endDate) {
      return c.json<ErrorResponse>(
        { success: false, error: "Valid start and end dates are required" },
        HttpStatus.BadRequest,
      );
    }

    if (endDate.getTime() < startDate.getTime()) {
      return c.json<ErrorResponse>(
        { success: false, error: "End date cannot be before start date" },
        HttpStatus.BadRequest,
      );
    }

    if (!reason) {
      return c.json<ErrorResponse>(
        { success: false, error: "Reason is required" },
        HttpStatus.BadRequest,
      );
    }

    const totalDays = calculateInclusiveDays(startDate, endDate);
    if (totalDays < 1) {
      return c.json<ErrorResponse>(
        { success: false, error: "Leave duration must be at least 1 day" },
        HttpStatus.BadRequest,
      );
    }

    if (applicantRole === Role.STUDENT && totalDays > STUDENT_MAX_LEAVE_DAYS) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: `Students cannot apply for more than ${STUDENT_MAX_LEAVE_DAYS} days of leave`,
        },
        HttpStatus.BadRequest,
      );
    }

    const profileExists =
      applicantRole === Role.STUDENT
        ? await db
            .select({ id: studentsTable.id })
            .from(studentsTable)
            .where(eq(studentsTable.userId, user.id))
            .limit(1)
        : await db
            .select({ id: teachersTable.id })
            .from(teachersTable)
            .where(eq(teachersTable.userId, user.id))
            .limit(1);

    if (!profileExists.length) {
      return c.json<ErrorResponse>(
        { success: false, error: "Applicant profile not found" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const [created] = await db
        .insert(leaveRequestsTable)
        .values({
          applicantUserId: user.id,
          applicantRole,
          leaveType,
          startDate,
          endDate,
          totalDays,
          reason,
        })
        .returning();

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Leave request submitted successfully",
          data: created,
        },
        HttpStatus.Created,
      );
    } catch (err) {
      console.error("Error creating leave request:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to submit leave request" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

leaveRouter.get(
  "/list",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER, Role.STUDENT]),
  async (c) => {
    const user = c.get("user");
    const userRoles = (c.get("userRole") ?? []) as string[];
    const status = c.req.query("status")?.trim();
    const applicantRoleFilter = c.req.query("applicantRole")?.trim();

    const filters = [];

    if (status && leaveStatusOptions.includes(status as (typeof leaveStatusOptions)[number])) {
      filters.push(eq(leaveRequestsTable.status, status as (typeof leaveStatusOptions)[number]));
    }

    if (userRoles.includes(Role.ADMIN)) {
      if (
        applicantRoleFilter &&
        (applicantRoleFilter === Role.STUDENT || applicantRoleFilter === Role.TEACHER)
      ) {
        filters.push(eq(leaveRequestsTable.applicantRole, applicantRoleFilter));
      }
    } else {
      filters.push(eq(leaveRequestsTable.applicantUserId, user.id));
    }

    try {
      const rows = await db
        .select({
          id: leaveRequestsTable.id,
          applicantUserId: leaveRequestsTable.applicantUserId,
          applicantName: usersTable.fullName,
          applicantRole: leaveRequestsTable.applicantRole,
          className: classesTable.name,
          designation: teachersTable.designation,
          leaveType: leaveRequestsTable.leaveType,
          startDate: leaveRequestsTable.startDate,
          endDate: leaveRequestsTable.endDate,
          totalDays: leaveRequestsTable.totalDays,
          reason: leaveRequestsTable.reason,
          status: leaveRequestsTable.status,
          adminRemarks: leaveRequestsTable.adminRemarks,
          createdAt: leaveRequestsTable.createdAt,
          reviewedAt: leaveRequestsTable.reviewedAt,
        })
        .from(leaveRequestsTable)
        .innerJoin(usersTable, eq(leaveRequestsTable.applicantUserId, usersTable.id))
        .leftJoin(studentsTable, eq(studentsTable.userId, usersTable.id))
        .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .leftJoin(teachersTable, eq(teachersTable.userId, usersTable.id))
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(leaveRequestsTable.createdAt));

      return c.json<SuccessResponse>({
        success: true,
        message: "Leave requests retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error retrieving leave requests:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve leave requests" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

leaveRouter.put(
  "/:id/status",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const payload = typeof body === "object" && body !== null ? body : {};

    const status = typeof payload.status === "string" ? payload.status.trim() : "";
    const adminRemarks =
      typeof payload.adminRemarks === "string" ? payload.adminRemarks.trim() : null;

    if (!leaveStatusOptions.includes(status as (typeof leaveStatusOptions)[number])) {
      return c.json<ErrorResponse>(
        { success: false, error: "Please select a valid leave status" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({ id: leaveRequestsTable.id })
        .from(leaveRequestsTable)
        .where(eq(leaveRequestsTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Leave request not found" },
          HttpStatus.NotFound,
        );
      }

      const [updated] = await db
        .update(leaveRequestsTable)
        .set({
          status: status as (typeof leaveStatusOptions)[number],
          adminRemarks,
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
        })
        .where(eq(leaveRequestsTable.id, id))
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: "Leave request updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating leave request:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update leave request" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default leaveRouter;
