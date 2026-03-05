import { Hono } from "hono";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { Role } from "../utils/roles";
import { db } from "../db";
import { Teacher, teachersTable } from "../db/schemas/teachers";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";
import {
  validateTeacherData,
  validateTeacherUpdateData,
} from "../middlewares/teacher.middleware";
import { usersTable } from "../db/schemas/users";
import { hashSync } from "bcryptjs";
import { rolesTable, userRolesTable } from "../db/schemas/roles";
import { and, eq, inArray, isNotNull, ne, or } from "drizzle-orm";
import { documentsTable } from "../db/schemas/documents";
import { classSubjectsTable } from "../db/schemas/exams";
import { mkdir, unlink } from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";

const teacherRouter = new Hono();
type TeacherWithUser = Teacher & {
  fullName: string;
  username: string;
  avatarUrl: string | null;
};
type DocumentItem = {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  fileSize: string | null;
  fileType: string | null;
  documentType: string;
  uploadedAt: Date | null;
  updatedAt: Date | null;
};

const teacherWithUserSelect = {
  id: teachersTable.id,
  userId: teachersTable.userId,
  mobileNo: teachersTable.mobileNo,
  fathersName: teachersTable.fathersName,
  mothersName: teachersTable.mothersName,
  dateOfBirth: teachersTable.dateOfBirth,
  address: teachersTable.address,
  aadharCard: teachersTable.aadharCard,
  panCard: teachersTable.panCard,
  emailId: teachersTable.emailId,
  designation: teachersTable.designation,
  qualification: teachersTable.qualification,
  accountNo: teachersTable.accountNo,
  bankIfsc: teachersTable.bankIfsc,
  bankName: teachersTable.bankName,
  createdAt: teachersTable.createdAt,
  updatedAt: teachersTable.updatedAt,
  fullName: usersTable.fullName,
  username: usersTable.username,
  avatarUrl: usersTable.avatarUrl,
};

const uploadRootDir = path.join(process.cwd(), "server", "upload");

const sanitizePathSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";

const sanitizeDocumentType = (value: string) =>
  sanitizePathSegment(value).slice(0, 100);

const getExtension = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();
  return extension.length <= 10 ? extension : "";
};

const inferDocumentTypeFromFileName = (fileName: string) => {
  const base = path.basename(fileName, path.extname(fileName));
  const tokens = base.split(/[_-]+/).filter(Boolean);
  if (tokens.length > 1) {
    return sanitizeDocumentType(tokens.slice(1).join("_"));
  }
  if (tokens.length === 1) {
    return sanitizeDocumentType(tokens[0]);
  }
  return "general";
};

const toFileArray = (value: unknown): File[] => {
  if (!value) return [];
  if (value instanceof File) return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is File => item instanceof File);
  }
  return [];
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

const generateTeacherPassword = (fullName: string, dateOfBirth: string) => {
  const firstName = fullName.trim().split(/\s+/)[0] ?? "";
  const initials = firstName.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3);
  const safeInitials = (initials || "USR").padEnd(3, "X");
  const birthYear = new Date(dateOfBirth).getFullYear();
  const safeYear = Number.isNaN(birthYear) ? "0000" : String(birthYear);
  return `${safeInitials}${safeYear}`;
};

teacherRouter.get(
  "/all",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const sessionId = c.req.query("sessionId")?.trim() ?? "";
    let result: TeacherWithUser[] = [];

    if (sessionId) {
      const teacherIds = await db
        .select({ teacherId: classSubjectsTable.teacherId })
        .from(classSubjectsTable)
        .where(
          and(
            eq(classSubjectsTable.sessionId, sessionId),
            isNotNull(classSubjectsTable.teacherId),
          ),
        )
        .groupBy(classSubjectsTable.teacherId);

      const ids = teacherIds
        .map((row) => row.teacherId)
        .filter((value): value is string => typeof value === "string");

      if (ids.length > 0) {
        result = await db
          .select(teacherWithUserSelect)
          .from(teachersTable)
          .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
          .where(inArray(teachersTable.id, ids));
      }
    } else {
      result = await db
        .select(teacherWithUserSelect)
        .from(teachersTable)
        .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id));
    }

    return c.json<SuccessResponse<TeacherWithUser[]>>({
      success: true,
      message: "Teachers retrieved successfully",
      data: result,
    });
  },
);

teacherRouter.post(
  "/:id/profile-pic",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const teacherId = c.req.param("id");

    try {
      const teacher = await db
        .select({
          id: teachersTable.id,
          userId: teachersTable.userId,
          mobileNo: teachersTable.mobileNo,
        })
        .from(teachersTable)
        .where(eq(teachersTable.id, teacherId))
        .limit(1);

      if (!teacher.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Teacher not found" },
          HttpStatus.NotFound,
        );
      }

      const body = await c.req.parseBody({ all: true });
      const file =
        body.avatar instanceof File
          ? body.avatar
          : body.file instanceof File
            ? body.file
            : null;

      if (!file || !file.name || file.size === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Profile image file is required" },
          HttpStatus.BadRequest,
        );
      }

      const teacherIdentifier = sanitizePathSegment(
        teacher[0].mobileNo || teacher[0].id,
      );
      const teacherUploadDir = path.join(uploadRootDir, teacherIdentifier);
      await mkdir(teacherUploadDir, { recursive: true });

      const extension = getExtension(file.name) || ".jpg";
      const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
      const finalPath = path.join(teacherUploadDir, savedFileName);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      await Bun.write(finalPath, fileBuffer);

      const avatarUrl = `/api/upload/${teacherIdentifier}/${savedFileName}`;
      const existingUser = await db
        .select({ avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(eq(usersTable.id, teacher[0].userId))
        .limit(1);
      const previousAvatarUrl = existingUser[0]?.avatarUrl ?? null;

      await db
        .update(usersTable)
        .set({ avatarUrl })
        .where(eq(usersTable.id, teacher[0].userId));

      if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
        try {
          await unlink(parseLocalPathFromFileUrl(previousAvatarUrl));
        } catch {
          // Keep API update successful even when old avatar is already missing.
        }
      }

      return c.json<SuccessResponse<{ avatarUrl: string }>>({
        success: true,
        message: "Profile picture updated successfully",
        data: { avatarUrl },
      });
    } catch (err) {
      console.error("Error uploading teacher profile picture:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to upload profile picture" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

teacherRouter.get(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const teacherId = c.req.param("id");

    const teacher = await db
      .select(teacherWithUserSelect)
      .from(teachersTable)
      .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(eq(teachersTable.id, teacherId))
      .limit(1);

    if (teacher.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Teacher not found" },
        HttpStatus.NotFound,
      );
    }

    return c.json<SuccessResponse<TeacherWithUser>>({
      success: true,
      message: "Teacher retrieved successfully",
      data: teacher[0],
    });
  },
);

teacherRouter.get(
  "/lookup/:identifier",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const identifier = c.req.param("identifier").trim();

    if (!identifier) {
      return c.json<ErrorResponse>(
        { success: false, error: "Identifier is required" },
        HttpStatus.BadRequest,
      );
    }

    const result = await db
      .select(teacherWithUserSelect)
      .from(teachersTable)
      .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(
        or(
          eq(teachersTable.mobileNo, identifier),
          eq(teachersTable.emailId, identifier),
          eq(usersTable.username, identifier),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Teacher not found" },
        HttpStatus.NotFound,
      );
    }

    return c.json<SuccessResponse<TeacherWithUser>>({
      success: true,
      message: "Teacher resolved successfully",
      data: result[0],
    });
  },
);

teacherRouter.post(
  "/add",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateTeacherData,
  async (c) => {
    const teacherData = c.req.valid("json");
    const username = teacherData.mobileNo.trim();
    const generatedPassword = generateTeacherPassword(
      teacherData.fullName,
      teacherData.dateOfBirth,
    );

    try {
      const newTeacher = await db.transaction(async (tx) => {
        const existingUser = await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, username))
          .limit(1);

        if (existingUser.length > 0) {
          throw {
            type: "conflict",
            message: `Teacher with this phone number ${username} already exists`,
          };
        }

        const [newUser] = await tx
          .insert(usersTable)
          .values({
            fullName: teacherData.fullName.trim(),
            username,
            password: hashSync(generatedPassword, 12),
          })
          .returning();

        const [teacherRole] = await tx
          .select()
          .from(rolesTable)
          .where(eq(rolesTable.name, Role.TEACHER))
          .limit(1);

        if (teacherRole) {
          await tx.insert(userRolesTable).values({
            userId: newUser.id,
            roleId: teacherRole.id,
          });
        }

        const [createdTeacher] = await tx
          .insert(teachersTable)
          .values({
            userId: newUser.id,
            mobileNo: teacherData.mobileNo.trim(),
            fathersName: teacherData.fathersName.trim(),
            mothersName: teacherData.mothersName.trim(),
            dateOfBirth: new Date(teacherData.dateOfBirth),
            address: teacherData.address.trim(),
            aadharCard: teacherData.aadharCard.trim(),
            panCard: teacherData.panCard.trim(),
            emailId: teacherData.emailId.trim(),
            designation: teacherData.designation.trim(),
            qualification: teacherData.qualification.trim(),
            accountNo: teacherData.accountNo.trim(),
            bankIfsc: teacherData.bankIfsc.trim(),
            bankName: teacherData.bankName.trim(),
          })
          .returning();

        return createdTeacher;
      });

      return c.json<SuccessResponse<{
        teacher: Teacher;
        credentials: { username: string; password: string };
      }>>({
        success: true,
        message: "Teacher added successfully",
        data: {
          teacher: newTeacher,
          credentials: {
            username,
            password: generatedPassword,
          },
        },
      });
    } catch (err: any) {
      if (err && err.type === "conflict") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.Conflict,
        );
      }
      console.error("Error adding teacher:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to add teacher" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

teacherRouter.put(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateTeacherUpdateData,
  async (c) => {
    const teacherId = c.req.param("id");
    const teacherData = c.req.valid("json");
    const username = teacherData.mobileNo.trim();

    try {
      const updatedTeacher = await db.transaction(async (tx) => {
        const existingTeacher = await tx
          .select({
            id: teachersTable.id,
            userId: teachersTable.userId,
          })
          .from(teachersTable)
          .where(eq(teachersTable.id, teacherId))
          .limit(1);

        if (existingTeacher.length === 0) {
          throw { type: "not_found", message: "Teacher not found" };
        }

        const teacherRecord = existingTeacher[0];

        const usernameOwner = await tx
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.username, username),
              ne(usersTable.id, teacherRecord.userId),
            ),
          )
          .limit(1);

        if (usernameOwner.length > 0) {
          throw {
            type: "conflict",
            message: `Teacher with this phone number ${username} already exists`,
          };
        }

        const userUpdateData: {
          fullName: string;
          username: string;
          password?: string;
        } = {
          fullName: teacherData.fullName.trim(),
          username,
        };

        if (teacherData.password && teacherData.password.trim()) {
          userUpdateData.password = hashSync(teacherData.password.trim(), 12);
        }

        await tx
          .update(usersTable)
          .set(userUpdateData)
          .where(eq(usersTable.id, teacherRecord.userId));

        await tx
          .update(teachersTable)
          .set({
            mobileNo: teacherData.mobileNo.trim(),
            fathersName: teacherData.fathersName.trim(),
            mothersName: teacherData.mothersName.trim(),
            dateOfBirth: new Date(teacherData.dateOfBirth),
            address: teacherData.address.trim(),
            aadharCard: teacherData.aadharCard.trim(),
            panCard: teacherData.panCard.trim(),
            emailId: teacherData.emailId.trim(),
            designation: teacherData.designation.trim(),
            qualification: teacherData.qualification.trim(),
            accountNo: teacherData.accountNo.trim(),
            bankIfsc: teacherData.bankIfsc.trim(),
            bankName: teacherData.bankName.trim(),
          })
          .where(eq(teachersTable.id, teacherId));

        const teacher = await tx
          .select(teacherWithUserSelect)
          .from(teachersTable)
          .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
          .where(eq(teachersTable.id, teacherId))
          .limit(1);

        return teacher[0];
      });

      return c.json<SuccessResponse<TeacherWithUser>>({
        success: true,
        message: "Teacher updated successfully",
        data: updatedTeacher,
      });
    } catch (err: any) {
      if (err?.type === "not_found") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.NotFound,
        );
      }
      if (err?.type === "conflict") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.Conflict,
        );
      }
      console.error("Error updating teacher:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update teacher" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

teacherRouter.get(
  "/:id/documents",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const teacherId = c.req.param("id");

    try {
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

      const docs = await db
        .select()
        .from(documentsTable)
        .where(eq(documentsTable.userId, teacher[0].userId));

      return c.json<SuccessResponse<DocumentItem[]>>({
        success: true,
        message: "Documents retrieved successfully",
        data: docs,
      });
    } catch (err) {
      console.error("Error retrieving documents:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve documents" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

teacherRouter.post(
  "/:id/documents",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const teacherId = c.req.param("id");

    try {
      const teacher = await db
        .select({
          id: teachersTable.id,
          userId: teachersTable.userId,
          mobileNo: teachersTable.mobileNo,
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

      const body = await c.req.parseBody({ all: true });
      const files = toFileArray(body.files);
      const rawDocumentType =
        typeof body.documentType === "string" ? body.documentType.trim() : "";

      if (files.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "At least one file is required" },
          HttpStatus.BadRequest,
        );
      }

      const teacherIdentifier = sanitizePathSegment(
        teacher[0].mobileNo || teacher[0].id,
      );
      const teacherUploadDir = path.join(uploadRootDir, teacherIdentifier);
      await mkdir(teacherUploadDir, { recursive: true });

      const insertedDocs: DocumentItem[] = [];

      for (const file of files) {
        if (!file.name || file.size === 0) continue;

        const extension = getExtension(file.name);
        const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
        const finalPath = path.join(teacherUploadDir, savedFileName);

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await Bun.write(finalPath, fileBuffer);

        const inferredType = rawDocumentType || inferDocumentTypeFromFileName(file.name);
        const [createdDoc] = await db
          .insert(documentsTable)
          .values({
            userId: teacher[0].userId,
            fileName: file.name,
            fileUrl: `/api/upload/${teacherIdentifier}/${savedFileName}`,
            fileSize: String(file.size),
            fileType: file.type || extension.replace(".", "") || "unknown",
            documentType: inferredType,
          })
          .returning();

        insertedDocs.push(createdDoc);
      }

      if (insertedDocs.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "No valid files were uploaded" },
          HttpStatus.BadRequest,
        );
      }

      return c.json<SuccessResponse<DocumentItem[]>>(
        {
          success: true,
          message: "Documents uploaded successfully",
          data: insertedDocs,
        },
        HttpStatus.Created,
      );
    } catch (err) {
      console.error("Error uploading documents:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to upload documents" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

teacherRouter.delete(
  "/:id/documents/:documentId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const teacherId = c.req.param("id");
    const documentId = c.req.param("documentId");

    try {
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

      const doc = await db
        .select()
        .from(documentsTable)
        .where(
          and(
            eq(documentsTable.id, documentId),
            eq(documentsTable.userId, teacher[0].userId),
          ),
        )
        .limit(1);

      if (doc.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Document not found" },
          HttpStatus.NotFound,
        );
      }

      await db.delete(documentsTable).where(eq(documentsTable.id, documentId));

      try {
        await unlink(parseLocalPathFromFileUrl(doc[0].fileUrl));
      } catch {
        // Keep API delete successful even if file is already missing on disk.
      }

      return c.json<SuccessResponse>({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting document:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete document" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

teacherRouter.delete(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const teacherId = c.req.param("id");

    try {
      const filesToDelete: string[] = [];
      await db.transaction(async (tx) => {
        const teacher = await tx
          .select({
            id: teachersTable.id,
            userId: teachersTable.userId,
            avatarUrl: usersTable.avatarUrl,
          })
          .from(teachersTable)
          .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
          .where(eq(teachersTable.id, teacherId))
          .limit(1);

        if (teacher.length === 0) {
          throw { type: "not_found", message: "Teacher not found" };
        }

        const docs = await tx
          .select({ fileUrl: documentsTable.fileUrl })
          .from(documentsTable)
          .where(eq(documentsTable.userId, teacher[0].userId));

        filesToDelete.push(...docs.map((doc) => doc.fileUrl));
        if (teacher[0].avatarUrl) {
          filesToDelete.push(teacher[0].avatarUrl);
        }

        await tx
          .delete(documentsTable)
          .where(eq(documentsTable.userId, teacher[0].userId));

        await tx.delete(teachersTable).where(eq(teachersTable.id, teacherId));

        await tx.delete(usersTable).where(eq(usersTable.id, teacher[0].userId));
      });

      for (const fileUrl of filesToDelete) {
        try {
          await unlink(parseLocalPathFromFileUrl(fileUrl));
        } catch {
          // Keep delete successful even when file is already absent on disk.
        }
      }

      return c.json<SuccessResponse>({
        success: true,
        message: "Teacher deleted successfully",
      });
    } catch (err: any) {
      if (err?.type === "not_found") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.NotFound,
        );
      }
      console.error("Error deleting teacher:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete teacher" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default teacherRouter;
