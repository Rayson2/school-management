import { Hono } from "hono";
import { and, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { mkdir, unlink } from "fs/promises";
import * as path from "path";
import { db } from "../db";
import { noticesTable, noticeTypeValues } from "../db/schemas/notices";
import { classesTable } from "../db/schemas/classes";
import { studentsTable } from "../db/schemas/students";
import { usersTable } from "../db/schemas/users";
import { classSubjectsTable } from "../db/schemas/exams";
import { teachersTable } from "../db/schemas/teachers";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";
import { Role } from "../utils/roles";

const noticeRouter = new Hono();

const uploadRootDir = path.join(process.cwd(), "server", "upload");
const noticesUploadDir = path.join(uploadRootDir, "notices");

const getExtension = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();
  return extension.length <= 10 ? extension : "";
};

const parseLocalPathFromFileUrl = (fileUrl: string) => {
  const normalizedUrl = fileUrl.trim();
  let pathname = normalizedUrl;
  if (normalizedUrl.startsWith("http")) {
    try {
      pathname = new URL(normalizedUrl).pathname;
    } catch {
      pathname = normalizedUrl;
    }
  }
  const relativePath = pathname
    .replace(/^\/api\/upload\//, "")
    .replace(/^\/upload\//, "");
  return path.join(uploadRootDir, relativePath);
};

const allowedNoticeTypes = new Set<string>(noticeTypeValues);
const isValidDate = (value: string) => !Number.isNaN(new Date(value).getTime());

const getTeacherProfileId = async (userId: string) => {
  const rows = await db
    .select({ id: teachersTable.id })
    .from(teachersTable)
    .where(eq(teachersTable.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
};

const getAssignedClassIdsForTeacherProfile = async (teacherProfileId: string) => {
  const rows = await db
    .select({ classId: classSubjectsTable.classId })
    .from(classSubjectsTable)
    .where(eq(classSubjectsTable.teacherId, teacherProfileId));
  return Array.from(new Set(rows.map((row) => row.classId)));
};

noticeRouter.get("/all", requireAuth, async (c) => {
  const user = c.get("user");
  const roles = (c.get("userRole") as string[]) ?? [];
  const requestedType = c.req.query("type")?.trim().toLowerCase();
  const classIdFilter = c.req.query("classId")?.trim();
  const fromDate = c.req.query("fromDate")?.trim();
  const toDate = c.req.query("toDate")?.trim();

  try {
    const isAdmin = roles.includes(Role.ADMIN);
    const isTeacher = roles.includes(Role.TEACHER);
    const isStudent = roles.includes(Role.STUDENT);
    let teacherAssignedClassIds: string[] = [];

    const whereClauses: any[] = [];

    if (!isAdmin) {
      if (isTeacher) {
        const teacherProfileId = await getTeacherProfileId(user.id);
        if (teacherProfileId) {
          teacherAssignedClassIds = await getAssignedClassIdsForTeacherProfile(
            teacherProfileId,
          );
        }

        const teacherAudienceClauses = [
          eq(noticesTable.noticeType, "teacher"),
          eq(noticesTable.noticeType, "general"),
        ];

        if (teacherAssignedClassIds.length) {
          teacherAudienceClauses.push(
            and(
              eq(noticesTable.noticeType, "class"),
              inArray(noticesTable.classId, teacherAssignedClassIds),
            ) as any,
          );
        }

        whereClauses.push(or(...teacherAudienceClauses));
      } else if (isStudent) {
        const student = await db
          .select({ classId: studentsTable.classId })
          .from(studentsTable)
          .where(eq(studentsTable.userId, user.id))
          .limit(1);

        const studentClassId = student[0]?.classId;
        if (studentClassId) {
          whereClauses.push(
            or(
              eq(noticesTable.noticeType, "general"),
              and(
                eq(noticesTable.noticeType, "class"),
                eq(noticesTable.classId, studentClassId),
              ),
            ),
          );
        } else {
          whereClauses.push(eq(noticesTable.noticeType, "general"));
        }
      } else {
        return c.json<ErrorResponse>(
          { success: false, error: "Forbidden" },
          HttpStatus.Forbidden,
        );
      }
    }

    if (requestedType && allowedNoticeTypes.has(requestedType)) {
      whereClauses.push(eq(noticesTable.noticeType, requestedType));
    }

    if (classIdFilter) {
      if (isTeacher && !teacherAssignedClassIds.includes(classIdFilter)) {
        return c.json<ErrorResponse>(
          { success: false, error: "You are not assigned to this class" },
          HttpStatus.Forbidden,
        );
      }
      whereClauses.push(eq(noticesTable.classId, classIdFilter));
    }

    if (fromDate) {
      if (!isValidDate(fromDate)) {
        return c.json<ErrorResponse>(
          { success: false, error: "Invalid fromDate" },
          HttpStatus.BadRequest,
        );
      }
      whereClauses.push(gte(noticesTable.createdAt, new Date(fromDate)));
    }

    if (toDate) {
      if (!isValidDate(toDate)) {
        return c.json<ErrorResponse>(
          { success: false, error: "Invalid toDate" },
          HttpStatus.BadRequest,
        );
      }
      const toDateObj = new Date(toDate);
      toDateObj.setHours(23, 59, 59, 999);
      whereClauses.push(lte(noticesTable.createdAt, toDateObj));
    }

    const notices = await db
      .select({
        id: noticesTable.id,
        title: noticesTable.title,
        description: noticesTable.description,
        noticeType: noticesTable.noticeType,
        classId: noticesTable.classId,
        className: classesTable.name,
        createdByUserId: noticesTable.createdByUserId,
        createdByName: usersTable.fullName,
        attachmentName: noticesTable.attachmentName,
        attachmentUrl: noticesTable.attachmentUrl,
        attachmentSize: noticesTable.attachmentSize,
        attachmentType: noticesTable.attachmentType,
        createdAt: noticesTable.createdAt,
        updatedAt: noticesTable.updatedAt,
      })
      .from(noticesTable)
      .leftJoin(classesTable, eq(noticesTable.classId, classesTable.id))
      .leftJoin(usersTable, eq(noticesTable.createdByUserId, usersTable.id))
      .where(whereClauses.length ? and(...whereClauses) : undefined)
      .orderBy(desc(noticesTable.createdAt));

    const data = notices.map((notice) => {
      const canEdit = isAdmin
        ? true
        : isTeacher &&
          notice.noticeType === "class" &&
          !!notice.classId &&
          teacherAssignedClassIds.includes(notice.classId);
      const canDelete = isAdmin;
      return { ...notice, canEdit, canDelete };
    });

    return c.json<SuccessResponse>({
      success: true,
      message: "Notices retrieved successfully",
      data,
    });
  } catch (err) {
    console.error("Error retrieving notices:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to retrieve notices" },
      HttpStatus.InternalServerError,
    );
  }
});

noticeRouter.post(
  "/add",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const user = c.get("user");
    const roles = (c.get("userRole") as string[]) ?? [];

    try {
      const body = await c.req.parseBody({ all: true });
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      const noticeType =
        typeof body.noticeType === "string"
          ? body.noticeType.trim().toLowerCase()
          : "";
      const classId = typeof body.classId === "string" ? body.classId.trim() : "";
      const file =
        body.attachment instanceof File
          ? body.attachment
          : body.file instanceof File
            ? body.file
            : null;

      if (!title) {
        return c.json<ErrorResponse>(
          { success: false, error: "Notice title is required" },
          HttpStatus.BadRequest,
        );
      }

      if (!description) {
        return c.json<ErrorResponse>(
          { success: false, error: "Notice description is required" },
          HttpStatus.BadRequest,
        );
      }

      if (!allowedNoticeTypes.has(noticeType)) {
        return c.json<ErrorResponse>(
          { success: false, error: "Invalid notice type" },
          HttpStatus.BadRequest,
        );
      }

      const isAdmin = roles.includes(Role.ADMIN);
      const isTeacher = roles.includes(Role.TEACHER);

      if (!isAdmin && !isTeacher) {
        return c.json<ErrorResponse>(
          { success: false, error: "Forbidden" },
          HttpStatus.Forbidden,
        );
      }

      if (isTeacher && noticeType === "teacher") {
        return c.json<ErrorResponse>(
          { success: false, error: "Only admin can post teacher notices" },
          HttpStatus.Forbidden,
        );
      }

      if (noticeType === "class" && !classId) {
        return c.json<ErrorResponse>(
          { success: false, error: "Class is required for class notice" },
          HttpStatus.BadRequest,
        );
      }

      if (classId) {
        const targetClass = await db
          .select({ id: classesTable.id })
          .from(classesTable)
          .where(eq(classesTable.id, classId))
          .limit(1);

        if (targetClass.length === 0) {
          return c.json<ErrorResponse>(
            { success: false, error: "Selected class does not exist" },
            HttpStatus.BadRequest,
          );
        }
      }

      let attachmentName: string | null = null;
      let attachmentUrl: string | null = null;
      let attachmentSize: string | null = null;
      let attachmentType: string | null = null;

      if (file && file.name && file.size > 0) {
        await mkdir(noticesUploadDir, { recursive: true });
        const extension = getExtension(file.name);
        const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
        const finalPath = path.join(noticesUploadDir, savedFileName);
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await Bun.write(finalPath, fileBuffer);

        attachmentName = file.name;
        attachmentUrl = `/api/upload/notices/${savedFileName}`;
        attachmentSize = String(file.size);
        attachmentType = file.type || extension.replace(".", "") || "unknown";
      }

      const [created] = await db
        .insert(noticesTable)
        .values({
          title,
          description,
          noticeType,
          classId: noticeType === "class" ? classId : null,
          createdByUserId: user.id,
          attachmentName,
          attachmentUrl,
          attachmentSize,
          attachmentType,
        })
        .returning();

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Notice created successfully",
          data: created,
        },
        HttpStatus.Created,
      );
    } catch (err) {
      console.error("Error creating notice:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create notice" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

noticeRouter.put(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const user = c.get("user");
    const roles = (c.get("userRole") as string[]) ?? [];
    const id = c.req.param("id");

    try {
      const existing = await db
        .select({
          id: noticesTable.id,
          createdByUserId: noticesTable.createdByUserId,
          attachmentUrl: noticesTable.attachmentUrl,
        })
        .from(noticesTable)
        .where(eq(noticesTable.id, id))
        .limit(1);

      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Notice not found" },
          HttpStatus.NotFound,
        );
      }

      const isAdmin = roles.includes(Role.ADMIN);
      if (!isAdmin) {
        const teacherProfileId = await getTeacherProfileId(user.id);
        if (!teacherProfileId) {
          return c.json<ErrorResponse>(
            { success: false, error: "Forbidden" },
            HttpStatus.Forbidden,
          );
        }

        const currentNoticeRows = await db
          .select({
            noticeType: noticesTable.noticeType,
            classId: noticesTable.classId,
          })
          .from(noticesTable)
          .where(eq(noticesTable.id, id))
          .limit(1);

        if (!currentNoticeRows.length) {
          return c.json<ErrorResponse>(
            { success: false, error: "Notice not found" },
            HttpStatus.NotFound,
          );
        }

        const currentNotice = currentNoticeRows[0];
        const assignedClassIds =
          await getAssignedClassIdsForTeacherProfile(teacherProfileId);

        const canEditThisNotice =
          currentNotice.noticeType === "class" &&
          !!currentNotice.classId &&
          assignedClassIds.includes(currentNotice.classId);

        if (!canEditThisNotice) {
          return c.json<ErrorResponse>(
            { success: false, error: "You can only edit class notices of your assigned classes" },
            HttpStatus.Forbidden,
          );
        }
      }

      if (!isAdmin && noticeType !== "class") {
        return c.json<ErrorResponse>(
          { success: false, error: "Teachers can edit only class notices" },
          HttpStatus.Forbidden,
        );
      }

      const body = await c.req.parseBody({ all: true });
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      const noticeType =
        typeof body.noticeType === "string"
          ? body.noticeType.trim().toLowerCase()
          : "";
      const classId = typeof body.classId === "string" ? body.classId.trim() : "";
      const removeAttachment =
        typeof body.removeAttachment === "string"
          ? body.removeAttachment === "true"
          : false;
      const file =
        body.attachment instanceof File
          ? body.attachment
          : body.file instanceof File
            ? body.file
            : null;

      if (!title) {
        return c.json<ErrorResponse>(
          { success: false, error: "Notice title is required" },
          HttpStatus.BadRequest,
        );
      }

      if (!description) {
        return c.json<ErrorResponse>(
          { success: false, error: "Notice description is required" },
          HttpStatus.BadRequest,
        );
      }

      if (!allowedNoticeTypes.has(noticeType)) {
        return c.json<ErrorResponse>(
          { success: false, error: "Invalid notice type" },
          HttpStatus.BadRequest,
        );
      }

      const isTeacher = roles.includes(Role.TEACHER);
      if (isTeacher && !isAdmin && noticeType === "teacher") {
        return c.json<ErrorResponse>(
          { success: false, error: "Only admin can post teacher notices" },
          HttpStatus.Forbidden,
        );
      }

      if (noticeType === "class" && !classId) {
        return c.json<ErrorResponse>(
          { success: false, error: "Class is required for class notice" },
          HttpStatus.BadRequest,
        );
      }

      if (classId) {
        const targetClass = await db
          .select({ id: classesTable.id })
          .from(classesTable)
          .where(eq(classesTable.id, classId))
          .limit(1);

        if (targetClass.length === 0) {
          return c.json<ErrorResponse>(
            { success: false, error: "Selected class does not exist" },
            HttpStatus.BadRequest,
          );
        }
      }

      if (!isAdmin) {
        const teacherProfileId = await getTeacherProfileId(user.id);
        if (!teacherProfileId) {
          return c.json<ErrorResponse>(
            { success: false, error: "Forbidden" },
            HttpStatus.Forbidden,
          );
        }
        const assignedClassIds =
          await getAssignedClassIdsForTeacherProfile(teacherProfileId);
        if (!classId || !assignedClassIds.includes(classId)) {
          return c.json<ErrorResponse>(
            { success: false, error: "You are not assigned to this class" },
            HttpStatus.Forbidden,
          );
        }
      }

      let attachmentName: string | null | undefined = undefined;
      let attachmentUrl: string | null | undefined = undefined;
      let attachmentSize: string | null | undefined = undefined;
      let attachmentType: string | null | undefined = undefined;
      let shouldDeleteOldAttachment = false;

      if (file && file.name && file.size > 0) {
        await mkdir(noticesUploadDir, { recursive: true });
        const extension = getExtension(file.name);
        const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
        const finalPath = path.join(noticesUploadDir, savedFileName);
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await Bun.write(finalPath, fileBuffer);

        attachmentName = file.name;
        attachmentUrl = `/api/upload/notices/${savedFileName}`;
        attachmentSize = String(file.size);
        attachmentType = file.type || extension.replace(".", "") || "unknown";
        shouldDeleteOldAttachment = true;
      } else if (removeAttachment) {
        attachmentName = null;
        attachmentUrl = null;
        attachmentSize = null;
        attachmentType = null;
        shouldDeleteOldAttachment = true;
      }

      const [updated] = await db
        .update(noticesTable)
        .set({
          title,
          description,
          noticeType,
          classId: noticeType === "class" ? classId : null,
          updatedAt: new Date(),
          ...(attachmentName !== undefined ? { attachmentName } : {}),
          ...(attachmentUrl !== undefined ? { attachmentUrl } : {}),
          ...(attachmentSize !== undefined ? { attachmentSize } : {}),
          ...(attachmentType !== undefined ? { attachmentType } : {}),
        })
        .where(eq(noticesTable.id, id))
        .returning();

      if (shouldDeleteOldAttachment && existing[0].attachmentUrl) {
        try {
          await unlink(parseLocalPathFromFileUrl(existing[0].attachmentUrl));
        } catch {
          // Keep API update successful even if old file is already missing.
        }
      }

      return c.json<SuccessResponse>({
        success: true,
        message: "Notice updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating notice:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update notice" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

noticeRouter.delete(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select({
          id: noticesTable.id,
          createdByUserId: noticesTable.createdByUserId,
          attachmentUrl: noticesTable.attachmentUrl,
        })
        .from(noticesTable)
        .where(eq(noticesTable.id, id))
        .limit(1);

      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Notice not found" },
          HttpStatus.NotFound,
        );
      }

      await db.delete(noticesTable).where(eq(noticesTable.id, id));

      if (existing[0].attachmentUrl) {
        try {
          await unlink(parseLocalPathFromFileUrl(existing[0].attachmentUrl));
        } catch {
          // Keep API delete successful even if file is already missing.
        }
      }

      return c.json<SuccessResponse>({
        success: true,
        message: "Notice deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting notice:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete notice" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default noticeRouter;
