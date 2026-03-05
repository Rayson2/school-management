import { Hono } from "hono";
import { and, count, eq, ilike, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { mkdir, unlink } from "fs/promises";
import * as path from "path";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { db } from "../db";
import { documentsTable } from "../db/schemas/documents";
import { usersTable } from "../db/schemas/users";
import { studentsTable } from "../db/schemas/students";
import { classesTable } from "../db/schemas/classes";
import { teachersTable } from "../db/schemas/teachers";
import { rolesTable, userRolesTable } from "../db/schemas/roles";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";
import { Role } from "../utils/roles";

const documentRouter = new Hono();

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

type ManageableUser = {
  userId: string;
  fullName: string;
  username: string;
  role: string;
  studentId: string | null;
  admissionNo: string | null;
  rollNumber: string | null;
  className: string | null;
  teacherId: string | null;
  mobileNo: string | null;
  qualification: string | null;
  designation: string | null;
  docCount: number;
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

const getUserForStorage = async (userId: string) => {
  const user = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  return user[0] ?? null;
};

const userHasManageableRole = async (userId: string) => {
  const roles = await db
    .select({ roleName: rolesTable.name })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, userId));

  return roles.some(
    (r) => r.roleName === Role.STUDENT || r.roleName === Role.TEACHER,
  );
};

const uploadDocumentsForUser = async ({
  userId,
  files,
  rawDocumentType,
}: {
  userId: string;
  files: File[];
  rawDocumentType: string;
}) => {
  const user = await getUserForStorage(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const userFolder = sanitizePathSegment(user.username || user.id);
  const userUploadDir = path.join(uploadRootDir, userFolder);
  await mkdir(userUploadDir, { recursive: true });

  const insertedDocs: DocumentItem[] = [];

  for (const file of files) {
    if (!file.name || file.size === 0) continue;

    const extension = getExtension(file.name);
    const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
    const finalPath = path.join(userUploadDir, savedFileName);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await Bun.write(finalPath, fileBuffer);

    const inferredType = rawDocumentType || inferDocumentTypeFromFileName(file.name);
    const [createdDoc] = await db
      .insert(documentsTable)
      .values({
        userId,
        fileName: file.name,
        fileUrl: `/api/upload/${userFolder}/${savedFileName}`,
        fileSize: String(file.size),
        fileType: file.type || extension.replace(".", "") || "unknown",
        documentType: inferredType,
      })
      .returning();

    insertedDocs.push(createdDoc);
  }

  return insertedDocs;
};

documentRouter.get("/me/documents", requireAuth, async (c) => {
  const user = c.get("user");

  try {
    const docs = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.userId, user.id));

    return c.json<SuccessResponse<DocumentItem[]>>({
      success: true,
      message: "Documents retrieved successfully",
      data: docs,
    });
  } catch (err) {
    console.error("Error retrieving self documents:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to retrieve documents" },
      HttpStatus.InternalServerError,
    );
  }
});

documentRouter.post("/me/documents", requireAuth, async (c) => {
  const user = c.get("user");

  try {
    const body = await c.req.parseBody({ all: true });
    const files = toFileArray(body.files);
    const rawDocumentType =
      typeof body.documentType === "string"
        ? sanitizeDocumentType(body.documentType.trim())
        : "";

    if (files.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "At least one file is required" },
        HttpStatus.BadRequest,
      );
    }

    const insertedDocs = await uploadDocumentsForUser({
      userId: user.id,
      files,
      rawDocumentType,
    });

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
    console.error("Error uploading self documents:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to upload documents" },
      HttpStatus.InternalServerError,
    );
  }
});

documentRouter.delete("/me/documents/:documentId", requireAuth, async (c) => {
  const user = c.get("user");
  const userRoles = (c.get("userRole") as string[]) ?? [];
  const documentId = c.req.param("documentId");

  try {
    if (userRoles.includes(Role.STUDENT)) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Students are not allowed to delete documents",
        },
        HttpStatus.Forbidden,
      );
    }

    const doc = await db
      .select()
      .from(documentsTable)
      .where(
        and(eq(documentsTable.id, documentId), eq(documentsTable.userId, user.id)),
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
      // Keep API delete successful even if file is already missing.
    }

    return c.json<SuccessResponse>({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting self document:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to delete document" },
      HttpStatus.InternalServerError,
    );
  }
});

documentRouter.get(
  "/admin/users",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const roleFilter = c.req.query("role")?.trim().toLowerCase() || "";
      const search = c.req.query("search")?.trim() || "";

      const whereClauses = [
        or(eq(rolesTable.name, Role.STUDENT), eq(rolesTable.name, Role.TEACHER)),
      ];

      if (roleFilter === Role.STUDENT || roleFilter === Role.TEACHER) {
        whereClauses.push(eq(rolesTable.name, roleFilter));
      }

      if (search) {
        whereClauses.push(
          or(
            ilike(usersTable.fullName, `%${search}%`),
            ilike(usersTable.username, `%${search}%`),
            ilike(studentsTable.admissionNo, `%${search}%`),
            ilike(studentsTable.rollNumber, `%${search}%`),
            ilike(teachersTable.mobileNo, `%${search}%`),
          )!,
        );
      }

      const rows = await db
        .select({
          userId: usersTable.id,
          fullName: usersTable.fullName,
          username: usersTable.username,
          role: rolesTable.name,
          studentId: studentsTable.id,
          admissionNo: studentsTable.admissionNo,
          rollNumber: studentsTable.rollNumber,
          className: classesTable.name,
          teacherId: teachersTable.id,
          mobileNo: teachersTable.mobileNo,
          qualification: teachersTable.qualification,
          designation: teachersTable.designation,
        })
        .from(usersTable)
        .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
        .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
        .leftJoin(studentsTable, eq(studentsTable.userId, usersTable.id))
        .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .leftJoin(teachersTable, eq(teachersTable.userId, usersTable.id))
        .where(and(...whereClauses));

      const deduped = new Map<string, ManageableUser>();

      for (const row of rows) {
        if (!deduped.has(row.userId)) {
          deduped.set(row.userId, {
            ...row,
            docCount: 0,
          });
        }
      }

      const entries = Array.from(deduped.values());

      for (const item of entries) {
        const docCountResult = await db
          .select({ value: count() })
          .from(documentsTable)
          .where(eq(documentsTable.userId, item.userId));
        item.docCount = Number(docCountResult[0]?.value ?? 0);
      }

      return c.json<SuccessResponse<ManageableUser[]>>({
        success: true,
        message: "Manageable users retrieved successfully",
        data: entries,
      });
    } catch (err) {
      console.error("Error retrieving manageable users:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve users" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.get(
  "/admin/users/:userId/documents",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const userId = c.req.param("userId");

    try {
      const allowed = await userHasManageableRole(userId);
      if (!allowed) {
        return c.json<ErrorResponse>(
          { success: false, error: "User is not a student or teacher" },
          HttpStatus.BadRequest,
        );
      }

      const docs = await db
        .select()
        .from(documentsTable)
        .where(eq(documentsTable.userId, userId));

      return c.json<SuccessResponse<DocumentItem[]>>({
        success: true,
        message: "Documents retrieved successfully",
        data: docs,
      });
    } catch (err) {
      console.error("Error retrieving user documents:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve documents" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.post(
  "/admin/users/:userId/documents",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const userId = c.req.param("userId");

    try {
      const allowed = await userHasManageableRole(userId);
      if (!allowed) {
        return c.json<ErrorResponse>(
          { success: false, error: "User is not a student or teacher" },
          HttpStatus.BadRequest,
        );
      }

      const body = await c.req.parseBody({ all: true });
      const files = toFileArray(body.files);
      const rawDocumentType =
        typeof body.documentType === "string"
          ? sanitizeDocumentType(body.documentType.trim())
          : "";

      if (files.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "At least one file is required" },
          HttpStatus.BadRequest,
        );
      }

      const insertedDocs = await uploadDocumentsForUser({
        userId,
        files,
        rawDocumentType,
      });

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
      console.error("Error uploading user documents:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to upload documents" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.delete(
  "/admin/users/:userId/documents/:documentId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const userId = c.req.param("userId");
    const documentId = c.req.param("documentId");

    try {
      const allowed = await userHasManageableRole(userId);
      if (!allowed) {
        return c.json<ErrorResponse>(
          { success: false, error: "User is not a student or teacher" },
          HttpStatus.BadRequest,
        );
      }

      const doc = await db
        .select()
        .from(documentsTable)
        .where(
          and(eq(documentsTable.id, documentId), eq(documentsTable.userId, userId)),
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
        // Keep API delete successful even if file is already missing.
      }

      return c.json<SuccessResponse>({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting user document:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete document" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default documentRouter;
