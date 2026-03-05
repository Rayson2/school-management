import { Hono } from "hono";
import { and, eq, ilike, ne } from "drizzle-orm";
import { db } from "../db";
import { academicSessionsTable } from "../db/schemas/academicSessions";
import { classSubjectsTable, examsTable, subjectsTable } from "../db/schemas/exams";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { Role } from "../utils/roles";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";

const academicSessionRouter = new Hono();

academicSessionRouter.get(
  "/all",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const query = c.req.query("q")?.trim();

    try {
      const rows = await db
        .select({
          id: academicSessionsTable.id,
          name: academicSessionsTable.name,
          enrollmentPrefix: academicSessionsTable.enrollmentPrefix,
          createdAt: academicSessionsTable.createdAt,
          updatedAt: academicSessionsTable.updatedAt,
        })
        .from(academicSessionsTable)
        .where(query ? ilike(academicSessionsTable.name, `%${query}%`) : undefined);

      return c.json<SuccessResponse>({
        success: true,
        message: "Academic sessions retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error retrieving academic sessions:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve academic sessions" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

academicSessionRouter.post(
  "/add",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const body = await c.req.json();
    const parsed = typeof body === "object" && body !== null ? body : {};
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const enrollmentPrefixRaw =
      typeof parsed.enrollmentPrefix === "string" ? parsed.enrollmentPrefix.trim() : "";
    const enrollmentPrefix = enrollmentPrefixRaw.toUpperCase();

    if (!name) {
      return c.json<ErrorResponse>(
        { success: false, error: "Session name is required" },
        HttpStatus.BadRequest,
      );
    }
    if (!enrollmentPrefix) {
      return c.json<ErrorResponse>(
        { success: false, error: "Enrollment prefix is required" },
        HttpStatus.BadRequest,
      );
    }
    if (!/^[A-Z0-9]+$/.test(enrollmentPrefix)) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Enrollment prefix must contain only letters and numbers",
        },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({ id: academicSessionsTable.id })
        .from(academicSessionsTable)
        .where(ilike(academicSessionsTable.name, name))
        .limit(1);

      if (existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Academic session already exists" },
          HttpStatus.Conflict,
        );
      }

      const [created] = await db
        .insert(academicSessionsTable)
        .values({ name, enrollmentPrefix })
        .returning();

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Academic session created successfully",
          data: created,
        },
        HttpStatus.Created,
      );
    } catch (err) {
      console.error("Error creating academic session:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create academic session" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

academicSessionRouter.put(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = typeof body === "object" && body !== null ? body : {};
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const enrollmentPrefixRaw =
      typeof parsed.enrollmentPrefix === "string" ? parsed.enrollmentPrefix.trim() : "";
    const enrollmentPrefix = enrollmentPrefixRaw.toUpperCase();

    if (!name) {
      return c.json<ErrorResponse>(
        { success: false, error: "Session name is required" },
        HttpStatus.BadRequest,
      );
    }
    if (!enrollmentPrefix) {
      return c.json<ErrorResponse>(
        { success: false, error: "Enrollment prefix is required" },
        HttpStatus.BadRequest,
      );
    }
    if (!/^[A-Z0-9]+$/.test(enrollmentPrefix)) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Enrollment prefix must contain only letters and numbers",
        },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({ id: academicSessionsTable.id })
        .from(academicSessionsTable)
        .where(eq(academicSessionsTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Academic session not found" },
          HttpStatus.NotFound,
        );
      }

      const duplicate = await db
        .select({ id: academicSessionsTable.id })
        .from(academicSessionsTable)
        .where(
          and(
            ilike(academicSessionsTable.name, name),
            ne(academicSessionsTable.id, id),
          ),
        )
        .limit(1);

      if (duplicate.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Academic session already exists" },
          HttpStatus.Conflict,
        );
      }

      const [updated] = await db
        .update(academicSessionsTable)
        .set({ name, enrollmentPrefix })
        .where(eq(academicSessionsTable.id, id))
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: "Academic session updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating academic session:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update academic session" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

academicSessionRouter.delete(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select({ id: academicSessionsTable.id })
        .from(academicSessionsTable)
        .where(eq(academicSessionsTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Academic session not found" },
          HttpStatus.NotFound,
        );
      }

      const [subjectRef, classSubjectRef, examRef] = await Promise.all([
        db
          .select({ id: subjectsTable.id })
          .from(subjectsTable)
          .where(eq(subjectsTable.sessionId, id))
          .limit(1),
        db
          .select({ id: classSubjectsTable.id })
          .from(classSubjectsTable)
          .where(eq(classSubjectsTable.sessionId, id))
          .limit(1),
        db
          .select({ id: examsTable.id })
          .from(examsTable)
          .where(eq(examsTable.sessionId, id))
          .limit(1),
      ]);

      if (subjectRef.length || classSubjectRef.length || examRef.length) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error: "Cannot delete session with linked subjects, class-subjects, or exams",
          },
          HttpStatus.BadRequest,
        );
      }

      await db.delete(academicSessionsTable).where(eq(academicSessionsTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Academic session deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting academic session:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete academic session" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default academicSessionRouter;
