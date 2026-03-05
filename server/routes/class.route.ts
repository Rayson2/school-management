import { Hono } from "hono";
import { and, eq, ilike, sql } from "drizzle-orm";
import { db } from "../db";
import { classesTable } from "../db/schemas/classes";
import { studentsTable } from "../db/schemas/students";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { Role } from "../utils/roles";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";

const classRouter = new Hono();

classRouter.get(
  "/all",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const query = c.req.query("q")?.trim();
    try {
      const rows = await db
        .select({
          id: classesTable.id,
          name: classesTable.name,
          createdAt: classesTable.createdAt,
          updatedAt: classesTable.updatedAt,
        })
        .from(classesTable)
        .where(query ? ilike(classesTable.name, `%${query}%`) : undefined);

      return c.json<SuccessResponse>({
        success: true,
        message: "Classes retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error retrieving classes:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve classes" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

classRouter.post(
  "/add",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const body = await c.req.json();
    const parsed = typeof body === "object" && body !== null ? body : {};
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";

    if (!name) {
      return c.json<ErrorResponse>(
        { success: false, error: "Class name is required" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(eq(classesTable.name, name))
        .limit(1);

      if (existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Class already exists" },
          HttpStatus.Conflict,
        );
      }

      const [created] = await db
        .insert(classesTable)
        .values({ name })
        .returning();

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Class created successfully",
          data: created,
        },
        HttpStatus.Created,
      );
    } catch (err) {
      console.error("Error creating class:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create class" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

classRouter.put(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = typeof body === "object" && body !== null ? body : {};
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";

    if (!name) {
      return c.json<ErrorResponse>(
        { success: false, error: "Class name is required" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const existing = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(eq(classesTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Class not found" },
          HttpStatus.NotFound,
        );
      }

      const duplicate = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(and(eq(classesTable.name, name), sql`${classesTable.id} <> ${id}`))
        .limit(1);

      if (duplicate.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Class already exists" },
          HttpStatus.Conflict,
        );
      }

      const [updated] = await db
        .update(classesTable)
        .set({ name })
        .where(eq(classesTable.id, id))
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: "Class updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating class:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update class" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

classRouter.delete(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(eq(classesTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Class not found" },
          HttpStatus.NotFound,
        );
      }

      const students = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(eq(studentsTable.classId, id))
        .limit(1);

      if (students.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Cannot delete class with assigned students" },
          HttpStatus.BadRequest,
        );
      }

      await db.delete(classesTable).where(eq(classesTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Class deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting class:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete class" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default classRouter;
