import { Hono } from "hono";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  admissionInquiriesTable,
  admissionInquiryStatusEnum,
} from "../db/schemas/admissionInquiries";
import { academicSessionsTable } from "../db/schemas/academicSessions";
import { classesTable } from "../db/schemas/classes";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { rolesTable, userRolesTable } from "../db/schemas/roles";
import { usersTable } from "../db/schemas/users";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";
import { Role } from "../utils/roles";

const admissionInquiryRouter = new Hono();

const publicGenderOptions = ["Male", "Female", "Other"] as const;
const DEFAULT_MEDIUM_OF_INSTRUCTION = "English";
const statusOptions = [...admissionInquiryStatusEnum.enumValues] as const;
type InquiryStatus = (typeof statusOptions)[number];
type SessionOption = { id: string; name: string };
type ClassOption = { id: string; name: string };
type StaffOption = { id: string; fullName: string };

const parseSessionStartYear = (sessionName: string) => {
  const match = sessionName.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : Number.NEGATIVE_INFINITY;
};

const getVisibleSessionStartYear = () => new Date().getFullYear() - 1;

const normalizeOptional = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseDateInput = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const calculateAge = (dateOfBirth: Date) => {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDifference = today.getMonth() - dateOfBirth.getMonth();
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }
  return age;
};

const generateInquiryId = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = now.getTime().toString().slice(-6);
  return `INQ-${y}${m}${d}-${suffix}`;
};

const getVisibleSessions = async () => {
  const sessions = await db
    .select({
      id: academicSessionsTable.id,
      name: academicSessionsTable.name,
    })
    .from(academicSessionsTable);

  const minimumStartYear = getVisibleSessionStartYear();

  return sessions
    .filter((session: SessionOption) => parseSessionStartYear(session.name) >= minimumStartYear)
    .sort(
      (a: SessionOption, b: SessionOption) =>
        parseSessionStartYear(a.name) - parseSessionStartYear(b.name),
    );
};

admissionInquiryRouter.get("/options", async (c) => {
  try {
    const [sessions, classes] = await Promise.all([
      getVisibleSessions(),
      db
        .select({
          id: classesTable.id,
          name: classesTable.name,
        })
        .from(classesTable),
    ]);

    return c.json<SuccessResponse>({
      success: true,
      message: "Admission inquiry options retrieved successfully",
      data: {
        genders: [...publicGenderOptions],
        sessions,
        classes: classes.sort((a: SessionOption, b: SessionOption) => a.name.localeCompare(b.name)),
        statuses: [...statusOptions],
      },
    });
  } catch (err) {
    console.error("Error retrieving admission inquiry options:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to retrieve admission inquiry options" },
      HttpStatus.InternalServerError,
    );
  }
});

admissionInquiryRouter.post("/add", async (c) => {
  const body = await c.req.json();
  const payload = typeof body === "object" && body !== null ? body : {};

  const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
  const gender = typeof payload.gender === "string" ? payload.gender.trim() : "";
  const applyingForClass =
    typeof payload.applyingForClass === "string" ? payload.applyingForClass.trim() : "";
  const sessionName =
    typeof payload.sessionName === "string" ? payload.sessionName.trim() : "";
  const primaryContactNumber =
    typeof payload.primaryContactNumber === "string"
      ? payload.primaryContactNumber.trim()
      : "";
  const fullAddress =
    typeof payload.fullAddress === "string" ? payload.fullAddress.trim() : "";
  const city = typeof payload.city === "string" ? payload.city.trim() : "";
  const state = typeof payload.state === "string" ? payload.state.trim() : "";
  const pinCode = typeof payload.pinCode === "string" ? payload.pinCode.trim() : "";
  const dateOfBirth = parseDateInput(payload.dateOfBirth);

  if (!fullName || !dateOfBirth || !gender || !applyingForClass || !sessionName) {
    return c.json<ErrorResponse>(
      {
        success: false,
        error:
          "Full name, date of birth, gender, applying for class, and session are required",
      },
      HttpStatus.BadRequest,
    );
  }

  if (!primaryContactNumber || !fullAddress || !city || !state || !pinCode) {
    return c.json<ErrorResponse>(
      {
        success: false,
        error:
          "Primary contact, address, city, state, and PIN code are required",
      },
      HttpStatus.BadRequest,
    );
  }

  const age = calculateAge(dateOfBirth);
  if (age < 0) {
    return c.json<ErrorResponse>(
      { success: false, error: "Date of birth is invalid" },
      HttpStatus.BadRequest,
    );
  }

  try {
    const [created] = await db
      .insert(admissionInquiriesTable)
      .values({
        inquiryId: generateInquiryId(),
        fullName,
        dateOfBirth,
        gender,
        age,
        previousSchoolName: normalizeOptional(payload.previousSchoolName),
        currentClassLastStudied: normalizeOptional(payload.currentClassLastStudied),
        applyingForClass,
        sessionName,
        mediumOfInstruction: DEFAULT_MEDIUM_OF_INSTRUCTION,
        fatherName: normalizeOptional(payload.fatherName),
        motherName: normalizeOptional(payload.motherName),
        guardianName: normalizeOptional(payload.guardianName),
        primaryContactNumber,
        alternateContactNumber: normalizeOptional(payload.alternateContactNumber),
        emailAddress: normalizeOptional(payload.emailAddress),
        fatherOccupation: normalizeOptional(payload.fatherOccupation),
        motherOccupation: normalizeOptional(payload.motherOccupation),
        fullAddress,
        city,
        state,
        pinCode,
        specialNeedsMedicalConditions: normalizeOptional(
          payload.specialNeedsMedicalConditions,
        ),
        remarksQuestions: normalizeOptional(payload.remarksQuestions),
      })
      .returning({
        id: admissionInquiriesTable.id,
        inquiryId: admissionInquiriesTable.inquiryId,
        status: admissionInquiriesTable.status,
      });

    return c.json<SuccessResponse>(
      {
        success: true,
        message: "Admission inquiry submitted successfully",
        data: created,
      },
      HttpStatus.Created,
    );
  } catch (err) {
    console.error("Error creating admission inquiry:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to submit admission inquiry" },
      HttpStatus.InternalServerError,
    );
  }
});

admissionInquiryRouter.get(
  "/admin-options",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const [sessions, classes, staffRows] = await Promise.all([
        getVisibleSessions(),
        db
          .select({
            id: classesTable.id,
            name: classesTable.name,
          })
          .from(classesTable),
        db
          .select({
            id: usersTable.id,
            fullName: usersTable.fullName,
          })
          .from(usersTable)
          .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
          .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
          .where(inArray(rolesTable.name, [Role.ADMIN, Role.TEACHER])),
      ]);

      const staffMap = new Map<string, StaffOption>();
      staffRows.forEach((row: StaffOption) => {
        if (!staffMap.has(row.id)) {
          staffMap.set(row.id, row);
        }
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Admission inquiry admin options retrieved successfully",
        data: {
          statuses: [...statusOptions],
          sessions,
          classes: classes.sort((a: ClassOption, b: ClassOption) => a.name.localeCompare(b.name)),
          staff: Array.from(staffMap.values()).sort((a, b) =>
            a.fullName.localeCompare(b.fullName),
          ),
        },
      });
    } catch (err) {
      console.error("Error retrieving admission inquiry admin options:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve admission inquiry admin options" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

admissionInquiryRouter.get(
  "/all",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const q = c.req.query("q")?.trim();
    const status = c.req.query("status")?.trim();
    const sessionName = c.req.query("sessionName")?.trim();
    const applyingForClass = c.req.query("applyingForClass")?.trim();

    const filters = [];
    if (q) {
      filters.push(
        ilike(
          admissionInquiriesTable.fullName,
          `%${q}%`,
        ),
      );
    }
    if (status && statusOptions.includes(status as (typeof statusOptions)[number])) {
      filters.push(eq(admissionInquiriesTable.status, status as (typeof statusOptions)[number]));
    }
    if (sessionName) {
      filters.push(eq(admissionInquiriesTable.sessionName, sessionName));
    }
    if (applyingForClass) {
      filters.push(eq(admissionInquiriesTable.applyingForClass, applyingForClass));
    }

    try {
      const rows = await db
        .select({
          id: admissionInquiriesTable.id,
          inquiryId: admissionInquiriesTable.inquiryId,
          fullName: admissionInquiriesTable.fullName,
          dateOfBirth: admissionInquiriesTable.dateOfBirth,
          gender: admissionInquiriesTable.gender,
          age: admissionInquiriesTable.age,
          previousSchoolName: admissionInquiriesTable.previousSchoolName,
          currentClassLastStudied: admissionInquiriesTable.currentClassLastStudied,
          applyingForClass: admissionInquiriesTable.applyingForClass,
          sessionName: admissionInquiriesTable.sessionName,
          mediumOfInstruction: admissionInquiriesTable.mediumOfInstruction,
          fatherName: admissionInquiriesTable.fatherName,
          motherName: admissionInquiriesTable.motherName,
          guardianName: admissionInquiriesTable.guardianName,
          primaryContactNumber: admissionInquiriesTable.primaryContactNumber,
          alternateContactNumber: admissionInquiriesTable.alternateContactNumber,
          emailAddress: admissionInquiriesTable.emailAddress,
          fatherOccupation: admissionInquiriesTable.fatherOccupation,
          motherOccupation: admissionInquiriesTable.motherOccupation,
          fullAddress: admissionInquiriesTable.fullAddress,
          city: admissionInquiriesTable.city,
          state: admissionInquiriesTable.state,
          pinCode: admissionInquiriesTable.pinCode,
          specialNeedsMedicalConditions:
            admissionInquiriesTable.specialNeedsMedicalConditions,
          remarksQuestions: admissionInquiriesTable.remarksQuestions,
          status: admissionInquiriesTable.status,
          assignedStaffUserId: admissionInquiriesTable.assignedStaffUserId,
          assignedStaffName: usersTable.fullName,
          followUpDate: admissionInquiriesTable.followUpDate,
          createdAt: admissionInquiriesTable.createdAt,
          updatedAt: admissionInquiriesTable.updatedAt,
        })
        .from(admissionInquiriesTable)
        .leftJoin(usersTable, eq(admissionInquiriesTable.assignedStaffUserId, usersTable.id))
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(admissionInquiriesTable.createdAt));

      return c.json<SuccessResponse>({
        success: true,
        message: "Admission inquiries retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error retrieving admission inquiries:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve admission inquiries" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

admissionInquiryRouter.put(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const payload = typeof body === "object" && body !== null ? body : {};

    const statusRaw = typeof payload.status === "string" ? payload.status.trim() : "";
    const assignedStaffUserId = normalizeOptional(payload.assignedStaffUserId);
    const followUpDate = parseDateInput(payload.followUpDate);
    const remarksQuestions = normalizeOptional(payload.remarksQuestions);

    if (
      !statusRaw ||
      !statusOptions.includes(statusRaw as (typeof statusOptions)[number])
    ) {
      return c.json<ErrorResponse>(
        { success: false, error: "A valid status is required" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({ id: admissionInquiriesTable.id })
        .from(admissionInquiriesTable)
        .where(eq(admissionInquiriesTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Admission inquiry not found" },
          HttpStatus.NotFound,
        );
      }

      const [updated] = await db
        .update(admissionInquiriesTable)
        .set({
          status: statusRaw as InquiryStatus,
          assignedStaffUserId,
          followUpDate,
          remarksQuestions,
        })
        .where(eq(admissionInquiriesTable.id, id))
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: "Admission inquiry updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating admission inquiry:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update admission inquiry" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default admissionInquiryRouter;
