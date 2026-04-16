import { Hono } from "hono";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import * as path from "path";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { db } from "../db";
import { documentsTable } from "../db/schemas/documents";
import {
  documentRequestsTable,
  documentRequestTypesTable,
} from "../db/schemas/documentRequests";
import { usersTable } from "../db/schemas/users";
import { studentsTable } from "../db/schemas/students";
import { classesTable } from "../db/schemas/classes";
import { teachersTable } from "../db/schemas/teachers";
import { rolesTable, userRolesTable } from "../db/schemas/roles";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";
import { Role } from "../utils/roles";
import {
  ensureDocumentSchema,
  sanitizeDocumentStatus,
} from "../utils/document-schema";
import {
  getStudentUploadControlConfig,
  resolveStudentUploadControl,
  saveStudentUploadControl,
} from "../utils/student-upload-controls";

const documentRouter = new Hono();

type DocumentTargetGroup = "student" | "teacher";

type DocumentItem = {
  id: string;
  userId: string;
  requestTypeId: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: string | null;
  fileType: string | null;
  documentType: string;
  status: string;
  uploadedAt: Date | null;
  updatedAt: Date | null;
};

type ManageableUser = {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  studentId: string | null;
  classId: string | null;
  admissionNo: string | null;
  rollNumber: string | null;
  className: string | null;
  teacherId: string | null;
  mobileNo: string | null;
  qualification: string | null;
  designation: string | null;
  docCount: number;
};

type DocumentRequestTypeItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type DocumentRequestItem = {
  id: string;
  requestTypeId: string;
  targetGroup: DocumentTargetGroup;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  requestType: DocumentRequestTypeItem;
};

type ActiveRequestRow = {
  id: string;
  requestTypeId: string;
  targetGroup: string;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  typeId: string;
  typeName: string;
  typeSlug: string;
  typeDescription: string | null;
  typeCreatedAt: Date | null;
  typeUpdatedAt: Date | null;
};

type TrackingRequestRow = {
  id: string;
  requestTypeId: string;
  targetGroup: string;
  isActive: boolean;
  typeName: string;
  typeSlug: string;
};

type TrackingUserRow = {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  className: string | null;
  designation: string | null;
};

type SelfDocumentRequirementPayload = {
  targetGroup: DocumentTargetGroup | null;
  activeRequests: Array<{
    requestId: string;
    requestTypeId: string;
    typeName: string;
    typeSlug: string;
    description: string | null;
    isActive: boolean;
  }>;
};

type StudentUploadControlItem = {
  scopeType: "all" | "class";
  classId: string | null;
  className: string | null;
  documentUploadEnabled: boolean;
  profileUploadEnabled: boolean;
  requestedDocumentTypes: string[];
  updatedAt: Date | null;
};

type StudentUploadControlPayload = {
  all: StudentUploadControlItem;
  classes: StudentUploadControlItem[];
};

type TrackingRow = {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  classOrRole: string;
  className: string | null;
  roleLabel: string | null;
  targetGroup: DocumentTargetGroup;
  progress: {
    uploaded: number;
    total: number;
  };
  documents: Array<{
    requestId: string;
    requestTypeId: string;
    typeName: string;
    typeSlug: string;
    isActive: boolean;
    uploaded: boolean;
    documentId: string | null;
    fileName: string | null;
    fileUrl: string | null;
    uploadedAt: Date | null;
    status: string | null;
  }>;
};

type TrackingDocument = TrackingRow["documents"][number];

type TrackingPayload = {
  targetGroup: DocumentTargetGroup;
  requests: Array<{
    id: string;
    isActive: boolean;
    requestTypeId: string;
    typeName: string;
    typeSlug: string;
  }>;
  totals: {
    users: number;
    requests: number;
    uploadedEntries: number;
    missingEntries: number;
  };
  rows: TrackingRow[];
};

type ProfilePayload = {
  user: {
    userId: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    targetGroup: DocumentTargetGroup;
    classOrRole: string;
    className: string | null;
    roleLabel: string | null;
    admissionNo: string | null;
    rollNumber: string | null;
    mobileNo: string | null;
    designation: string | null;
    qualification: string | null;
  };
  requiredDocuments: TrackingRow["documents"];
  otherDocuments: DocumentItem[];
};

const uploadRootDir = path.join(process.cwd(), "server", "upload");

const sanitizePathSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";

const normalizeDocumentSlug = (value: string) =>
  sanitizePathSegment(value).slice(0, 120);

const inferDocumentTypeFromFileName = (fileName: string) => {
  const base = path.basename(fileName, path.extname(fileName));
  const tokens = base.split(/[_-]+/).filter(Boolean);
  if (tokens.length > 1) {
    return normalizeDocumentSlug(tokens.slice(1).join("-"));
  }
  if (tokens.length === 1) {
    return normalizeDocumentSlug(tokens[0]);
  }
  return "general";
};

const getExtension = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();
  return extension.length <= 10 ? extension : "";
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

const titleCaseSlug = (value: string) =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const escapeCsvCell = (value: string | null | undefined) => {
  const text = value ?? "";
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const ensureDocumentRequestSchema = async () => {
  await ensureDocumentSchema();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_request_types (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" varchar(120) NOT NULL,
      "slug" varchar(120) NOT NULL,
      "description" varchar(500),
      "createdAt" timestamp with time zone DEFAULT now(),
      "updatedAt" timestamp with time zone
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS document_request_types_slug_idx
    ON document_request_types ("slug")
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_requests (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "requestTypeId" uuid NOT NULL REFERENCES document_request_types("id") ON DELETE CASCADE,
      "targetGroup" varchar(30) NOT NULL,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp with time zone DEFAULT now(),
      "updatedAt" timestamp with time zone
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS document_requests_target_type_idx
    ON document_requests ("requestTypeId", "targetGroup")
  `);
  await db.execute(
    sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS "requestTypeId" uuid`,
  );
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
    (r: { roleName: string }) =>
      r.roleName === Role.STUDENT || r.roleName === Role.TEACHER,
  );
};

const getUserTargetGroup = (roles: string[]): DocumentTargetGroup | null => {
  if (roles.includes(Role.STUDENT)) return "student";
  if (roles.includes(Role.TEACHER)) return "teacher";
  return null;
};

const getActiveRequestsForTargetGroup = async (
  targetGroup: DocumentTargetGroup,
): Promise<ActiveRequestRow[]> => {
  await ensureDocumentRequestSchema();
  return db
    .select({
      id: documentRequestsTable.id,
      requestTypeId: documentRequestsTable.requestTypeId,
      targetGroup: documentRequestsTable.targetGroup,
      isActive: documentRequestsTable.isActive,
      createdAt: documentRequestsTable.createdAt,
      updatedAt: documentRequestsTable.updatedAt,
      typeId: documentRequestTypesTable.id,
      typeName: documentRequestTypesTable.name,
      typeSlug: documentRequestTypesTable.slug,
      typeDescription: documentRequestTypesTable.description,
      typeCreatedAt: documentRequestTypesTable.createdAt,
      typeUpdatedAt: documentRequestTypesTable.updatedAt,
    })
    .from(documentRequestsTable)
    .innerJoin(
      documentRequestTypesTable,
      eq(documentRequestsTable.requestTypeId, documentRequestTypesTable.id),
    )
    .where(
      and(
        eq(documentRequestsTable.targetGroup, targetGroup),
        eq(documentRequestsTable.isActive, true),
      ),
    )
    .orderBy(documentRequestTypesTable.name);
};

const getAllRequestTypesMap = async () => {
  await ensureDocumentRequestSchema();
  const types = await db
    .select()
    .from(documentRequestTypesTable)
    .orderBy(documentRequestTypesTable.name);
  return new Map(types.map((item: DocumentRequestTypeItem) => [item.slug, item]));
};

const resolveUserTrackingRows = async (
  targetGroup: DocumentTargetGroup,
  search: string,
): Promise<TrackingPayload> => {
  await ensureDocumentRequestSchema();

  const requestRows: TrackingRequestRow[] = await db
    .select({
      id: documentRequestsTable.id,
      requestTypeId: documentRequestsTable.requestTypeId,
      targetGroup: documentRequestsTable.targetGroup,
      isActive: documentRequestsTable.isActive,
      typeName: documentRequestTypesTable.name,
      typeSlug: documentRequestTypesTable.slug,
    })
    .from(documentRequestsTable)
    .innerJoin(
      documentRequestTypesTable,
      eq(documentRequestsTable.requestTypeId, documentRequestTypesTable.id),
    )
    .where(eq(documentRequestsTable.targetGroup, targetGroup))
    .orderBy(desc(documentRequestsTable.isActive), documentRequestTypesTable.name);

  const activeRequests = requestRows.filter((item: TrackingRequestRow) => item.isActive);
  const searchTerm = search.trim();

  const userWhereClauses =
    targetGroup === "student"
      ? [
          eq(rolesTable.name, Role.STUDENT),
          ...(searchTerm
            ? [
                or(
                  ilike(usersTable.fullName, `%${searchTerm}%`),
                  ilike(usersTable.username, `%${searchTerm}%`),
                  ilike(studentsTable.admissionNo, `%${searchTerm}%`),
                  ilike(studentsTable.rollNumber, `%${searchTerm}%`),
                  ilike(classesTable.name, `%${searchTerm}%`),
                )!,
              ]
            : []),
        ]
      : [
          eq(rolesTable.name, Role.TEACHER),
          ...(searchTerm
            ? [
                or(
                  ilike(usersTable.fullName, `%${searchTerm}%`),
                  ilike(usersTable.username, `%${searchTerm}%`),
                  ilike(teachersTable.designation, `%${searchTerm}%`),
                  ilike(teachersTable.mobileNo, `%${searchTerm}%`),
                )!,
              ]
            : []),
        ];

  const userRows: TrackingUserRow[] = await db
    .select({
      userId: usersTable.id,
      fullName: usersTable.fullName,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      className: classesTable.name,
      designation: teachersTable.designation,
    })
    .from(usersTable)
    .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .leftJoin(studentsTable, eq(studentsTable.userId, usersTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(teachersTable, eq(teachersTable.userId, usersTable.id))
    .where(and(...userWhereClauses))
    .orderBy(usersTable.fullName);

  const userIds = userRows.map((item: TrackingUserRow) => item.userId);
  const activeRequestIds = activeRequests.map((item: TrackingRequestRow) => item.requestTypeId);
  const activeRequestSlugs = activeRequests.map((item: TrackingRequestRow) => item.typeSlug);

  const documents =
    userIds.length > 0 && activeRequests.length > 0
      ? await db
          .select()
          .from(documentsTable)
          .where(
            and(
              inArray(documentsTable.userId, userIds),
              or(
                inArray(documentsTable.requestTypeId, activeRequestIds),
                inArray(documentsTable.documentType, activeRequestSlugs),
              )!,
            ),
          )
          .orderBy(desc(documentsTable.uploadedAt))
      : [];

  const latestDocumentsByUserAndType = new Map<string, DocumentItem>();
  for (const doc of documents) {
    const matchByRequestId =
      doc.requestTypeId &&
      activeRequests.find(
        (item: TrackingRequestRow) => item.requestTypeId === doc.requestTypeId,
      );
    const matchBySlug = activeRequests.find(
      (item: TrackingRequestRow) => item.typeSlug === doc.documentType,
    );
    const resolvedTypeId = matchByRequestId?.requestTypeId ?? matchBySlug?.requestTypeId;
    if (!resolvedTypeId) continue;
    const key = `${doc.userId}:${resolvedTypeId}`;
    if (!latestDocumentsByUserAndType.has(key)) {
      latestDocumentsByUserAndType.set(key, doc);
    }
  }

  const rows: TrackingRow[] = userRows.map((user: TrackingUserRow) => {
    const documentsForUser = activeRequests.map((request: TrackingRequestRow) => {
      const match =
        latestDocumentsByUserAndType.get(`${user.userId}:${request.requestTypeId}`) ?? null;
      return {
        requestId: request.id,
        requestTypeId: request.requestTypeId,
        typeName: request.typeName,
        typeSlug: request.typeSlug,
        isActive: request.isActive,
        uploaded: Boolean(match),
        documentId: match?.id ?? null,
        fileName: match?.fileName ?? null,
        fileUrl: match?.fileUrl ?? null,
        uploadedAt: match?.uploadedAt ?? null,
        status: match?.status ?? null,
      };
    });

    const uploaded = documentsForUser.filter(
      (item: TrackingDocument) => item.uploaded,
    ).length;

    return {
      userId: user.userId,
      fullName: user.fullName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      classOrRole:
        targetGroup === "student" ? user.className || "Unassigned class" : user.designation || "Teacher",
      className: user.className,
      roleLabel: user.designation,
      targetGroup,
      progress: {
        uploaded,
        total: documentsForUser.length,
      },
      documents: documentsForUser,
    };
  });

  const totalSlots = rows.reduce((sum, row) => sum + row.progress.total, 0);
  const uploadedEntries = rows.reduce((sum, row) => sum + row.progress.uploaded, 0);

  return {
    targetGroup,
    requests: requestRows,
    totals: {
      users: rows.length,
      requests: activeRequests.length,
      uploadedEntries,
      missingEntries: Math.max(totalSlots - uploadedEntries, 0),
    },
    rows,
  };
};

const uploadDocumentsForUser = async ({
  userId,
  files,
  rawDocumentType,
  requestTypeId,
}: {
  userId: string;
  files: File[];
  rawDocumentType: string;
  requestTypeId?: string | null;
}) => {
  await ensureDocumentRequestSchema();
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
    await writeFile(finalPath, fileBuffer);

    const inferredType = rawDocumentType || inferDocumentTypeFromFileName(file.name);
    const [createdDoc] = await db
      .insert(documentsTable)
      .values({
        userId,
        requestTypeId: requestTypeId ?? null,
        fileName: file.name,
        fileUrl: `/api/upload/${userFolder}/${savedFileName}`,
        fileSize: String(file.size),
        fileType: file.type || extension.replace(".", "") || "unknown",
        documentType: inferredType,
        status: "pending",
      })
      .returning();

    insertedDocs.push(createdDoc);
  }

  return insertedDocs;
};

documentRouter.get("/me/documents", requireAuth, async (c) => {
  const user = (c as any).get("user") as { id: string };

  try {
    await ensureDocumentRequestSchema();
    const docs = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.userId, user.id))
      .orderBy(desc(documentsTable.uploadedAt));

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

documentRouter.get("/me/requirements", requireAuth, async (c) => {
  const userRoles = (((c as any).get("userRole") as string[]) ?? []);

  try {
    const targetGroup = getUserTargetGroup(userRoles);
    if (!targetGroup) {
      return c.json<SuccessResponse<SelfDocumentRequirementPayload>>({
        success: true,
        message: "Document requirements retrieved successfully",
        data: {
          targetGroup: null,
          activeRequests: [],
        },
      });
    }

    const requests = await getActiveRequestsForTargetGroup(targetGroup);
    return c.json<SuccessResponse<SelfDocumentRequirementPayload>>({
      success: true,
      message: "Document requirements retrieved successfully",
      data: {
        targetGroup,
        activeRequests: requests.map((item: ActiveRequestRow) => ({
          requestId: item.id,
          requestTypeId: item.requestTypeId,
          typeName: item.typeName,
          typeSlug: item.typeSlug,
          description: item.typeDescription,
          isActive: item.isActive,
        })),
      },
    });
  } catch (err) {
    console.error("Error retrieving self document requirements:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to retrieve document requirements" },
      HttpStatus.InternalServerError,
    );
  }
});

documentRouter.get("/me/upload-controls", requireAuth, async (c) => {
  const userRoles = (((c as any).get("userRole") as string[]) ?? []);

  try {
    const targetGroup = getUserTargetGroup(userRoles);
    if (targetGroup !== "student") {
      return c.json({
        success: true,
        message: "Upload controls retrieved successfully",
        data: {
          documentUploadEnabled: true,
          profileUploadEnabled: true,
          requestedDocumentTypes: [],
          scopeType: "all",
          classId: null,
          className: null,
          updatedAt: null,
        },
      });
    }

    const [requests, control] = await Promise.all([
      getActiveRequestsForTargetGroup("student"),
      resolveStudentUploadControl(((c as any).get("user") as { id: string }).id),
    ]);
    return c.json({
      success: true,
      message: "Upload controls retrieved successfully",
      data: {
        documentUploadEnabled: control.documentUploadEnabled,
        profileUploadEnabled: control.profileUploadEnabled,
        requestedDocumentTypes: requests.map((item: ActiveRequestRow) => item.typeSlug),
        scopeType: control.scopeType,
        classId: control.classId,
        className: control.className,
        updatedAt: control.updatedAt,
      },
    });
  } catch (err) {
    console.error("Error retrieving self upload controls:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to retrieve upload controls" },
      HttpStatus.InternalServerError,
    );
  }
});

documentRouter.post("/me/documents", requireAuth, async (c) => {
  const user = (c as any).get("user") as { id: string };
  const userRoles = (((c as any).get("userRole") as string[]) ?? []);

  try {
    await ensureDocumentRequestSchema();
    const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
    const files = toFileArray(body.files);
    const requestTypeId =
      typeof body.requestTypeId === "string" && body.requestTypeId.trim()
        ? body.requestTypeId.trim()
        : null;
    const rawDocumentType =
      typeof body.documentType === "string"
        ? normalizeDocumentSlug(body.documentType.trim())
        : "";

    if (files.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "At least one file is required" },
        HttpStatus.BadRequest,
      );
    }

    const targetGroup = getUserTargetGroup(userRoles);
    let resolvedRequestTypeId: string | null = requestTypeId;
    let resolvedDocumentType = rawDocumentType;

    if (targetGroup) {
      if (targetGroup === "student") {
        const control = await resolveStudentUploadControl(user.id);
        if (!control.documentUploadEnabled) {
          return c.json<ErrorResponse>(
            {
              success: false,
              error: "Document upload is currently turned off for your account",
            },
            HttpStatus.Forbidden,
          );
        }
      }

      const [activeRequests, allTypes] = await Promise.all([
        getActiveRequestsForTargetGroup(targetGroup),
        getAllRequestTypesMap(),
      ]);

      const activeById = new Map(
        activeRequests.map((item: ActiveRequestRow) => [item.requestTypeId, item]),
      );
      const activeBySlug = new Map(
        activeRequests.map((item: ActiveRequestRow) => [item.typeSlug, item]),
      );

      if (requestTypeId && !activeById.has(requestTypeId)) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error: "This document request is currently inactive for your account",
          },
          HttpStatus.Forbidden,
        );
      }

      if (!requestTypeId && rawDocumentType) {
        const matchedActive = activeBySlug.get(rawDocumentType);
        if (matchedActive) {
          resolvedRequestTypeId = matchedActive.requestTypeId;
        } else if (allTypes.has(rawDocumentType)) {
          return c.json<ErrorResponse>(
            {
              success: false,
              error: "This document request is currently inactive for your account",
            },
            HttpStatus.Forbidden,
          );
        }
      }

      if (resolvedRequestTypeId && activeById.has(resolvedRequestTypeId)) {
        const matchedActive = activeById.get(resolvedRequestTypeId)!;
        resolvedDocumentType = matchedActive.typeSlug;
      }
    }

    const insertedDocs = await uploadDocumentsForUser({
      userId: user.id,
      files,
      rawDocumentType: resolvedDocumentType,
      requestTypeId: resolvedRequestTypeId,
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
  const user = (c as any).get("user") as { id: string };
  const userRoles = (((c as any).get("userRole") as string[]) ?? []);
  const documentId = c.req.param("documentId");

  try {
    await ensureDocumentRequestSchema();
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
  "/admin/student-upload-controls",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const controls = await getStudentUploadControlConfig();
      const studentRequests = await getActiveRequestsForTargetGroup("student");

      return c.json<SuccessResponse<StudentUploadControlPayload>>({
        success: true,
        message: "Student upload controls retrieved successfully",
        data: {
          all: {
            ...controls.all,
            requestedDocumentTypes: studentRequests.map((item: ActiveRequestRow) => item.typeSlug),
          },
          classes: controls.classes.map((item) => ({
            ...item,
            requestedDocumentTypes: studentRequests.map(
              (request: ActiveRequestRow) => request.typeSlug,
            ),
          })),
        },
      });
    } catch (err) {
      console.error("Error retrieving student upload controls:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve student upload controls" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.put(
  "/admin/student-upload-controls",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const scopeType = body?.scopeType === "class" ? "class" : "all";
      const classId =
        scopeType === "class" && typeof body?.classId === "string" && body.classId.trim()
          ? body.classId.trim()
          : null;

      if (scopeType === "class" && !classId) {
        return c.json<ErrorResponse>(
          { success: false, error: "A class is required for class-level controls" },
          HttpStatus.BadRequest,
        );
      }

      await saveStudentUploadControl({
        scopeType,
        classId,
        documentUploadEnabled: Boolean(body?.documentUploadEnabled),
        profileUploadEnabled: Boolean(body?.profileUploadEnabled),
        requestedDocumentTypes: [],
      });

      const controls = await getStudentUploadControlConfig();
      const studentRequests = await getActiveRequestsForTargetGroup("student");

      return c.json<SuccessResponse<StudentUploadControlPayload>>({
        success: true,
        message: "Student upload controls updated successfully",
        data: {
          all: {
            ...controls.all,
            requestedDocumentTypes: studentRequests.map((item: ActiveRequestRow) => item.typeSlug),
          },
          classes: controls.classes.map((item) => ({
            ...item,
            requestedDocumentTypes: studentRequests.map(
              (request: ActiveRequestRow) => request.typeSlug,
            ),
          })),
        },
      });
    } catch (err) {
      console.error("Error updating student upload controls:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update student upload controls" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.get(
  "/admin/request-types",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      await ensureDocumentRequestSchema();
      const types = await db
        .select()
        .from(documentRequestTypesTable)
        .orderBy(documentRequestTypesTable.name);

      return c.json<SuccessResponse<DocumentRequestTypeItem[]>>({
        success: true,
        message: "Document request types retrieved successfully",
        data: types,
      });
    } catch (err) {
      console.error("Error retrieving document request types:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve document request types" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.post(
  "/admin/request-types",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      await ensureDocumentRequestSchema();
      const body = await c.req.json().catch(() => ({}));
      const name =
        typeof body?.name === "string" ? body.name.trim() : "";
      const description =
        typeof body?.description === "string" ? body.description.trim() : "";
      const requestedSlug =
        typeof body?.slug === "string" ? normalizeDocumentSlug(body.slug) : "";
      const slug = requestedSlug || normalizeDocumentSlug(name);

      if (!name || !slug) {
        return c.json<ErrorResponse>(
          { success: false, error: "Name is required" },
          HttpStatus.BadRequest,
        );
      }

      const existing = await db
        .select({ id: documentRequestTypesTable.id })
        .from(documentRequestTypesTable)
        .where(eq(documentRequestTypesTable.slug, slug))
        .limit(1);

      if (existing.length > 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "A document type with this slug already exists" },
          HttpStatus.Conflict,
        );
      }

      const [created] = await db
        .insert(documentRequestTypesTable)
        .values({
          name,
          slug,
          description: description || null,
        })
        .returning();

      return c.json<SuccessResponse<DocumentRequestTypeItem>>(
        {
          success: true,
          message: "Document request type created successfully",
          data: created,
        },
        HttpStatus.Created,
      );
    } catch (err) {
      console.error("Error creating document request type:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create document request type" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.put(
  "/admin/request-types/:typeId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const typeId = c.req.param("typeId");

    try {
      await ensureDocumentRequestSchema();
      const body = await c.req.json().catch(() => ({}));
      const name =
        typeof body?.name === "string" ? body.name.trim() : "";
      const description =
        typeof body?.description === "string" ? body.description.trim() : "";

      if (!name) {
        return c.json<ErrorResponse>(
          { success: false, error: "Name is required" },
          HttpStatus.BadRequest,
        );
      }

      const existing = await db
        .select()
        .from(documentRequestTypesTable)
        .where(eq(documentRequestTypesTable.id, typeId))
        .limit(1);

      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Document type not found" },
          HttpStatus.NotFound,
        );
      }

      const [updated] = await db
        .update(documentRequestTypesTable)
        .set({
          name,
          description: description || null,
          updatedAt: new Date(),
        })
        .where(eq(documentRequestTypesTable.id, typeId))
        .returning();

      return c.json<SuccessResponse<DocumentRequestTypeItem>>({
        success: true,
        message: "Document request type updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating document request type:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update document request type" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.delete(
  "/admin/request-types/:typeId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const typeId = c.req.param("typeId");

    try {
      await ensureDocumentRequestSchema();

      const linkedRequests = await db
        .select({ value: count() })
        .from(documentRequestsTable)
        .where(eq(documentRequestsTable.requestTypeId, typeId));

      if (Number(linkedRequests[0]?.value ?? 0) > 0) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error: "Remove the linked requests before deleting this document type",
          },
          HttpStatus.Conflict,
        );
      }

      await db
        .delete(documentRequestTypesTable)
        .where(eq(documentRequestTypesTable.id, typeId));

      return c.json<SuccessResponse>({
        success: true,
        message: "Document request type deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting document request type:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete document request type" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.get(
  "/admin/requests",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      await ensureDocumentRequestSchema();
      const targetGroup = c.req.query("targetGroup")?.trim() as DocumentTargetGroup | undefined;

      const requestRows: ActiveRequestRow[] = await db
        .select({
          id: documentRequestsTable.id,
          requestTypeId: documentRequestsTable.requestTypeId,
          targetGroup: documentRequestsTable.targetGroup,
          isActive: documentRequestsTable.isActive,
          createdAt: documentRequestsTable.createdAt,
          updatedAt: documentRequestsTable.updatedAt,
          typeId: documentRequestTypesTable.id,
          typeName: documentRequestTypesTable.name,
          typeSlug: documentRequestTypesTable.slug,
          typeDescription: documentRequestTypesTable.description,
          typeCreatedAt: documentRequestTypesTable.createdAt,
          typeUpdatedAt: documentRequestTypesTable.updatedAt,
        })
        .from(documentRequestsTable)
        .innerJoin(
          documentRequestTypesTable,
          eq(documentRequestsTable.requestTypeId, documentRequestTypesTable.id),
        )
        .orderBy(desc(documentRequestsTable.isActive), documentRequestTypesTable.name);

      const filteredRequestRows =
        targetGroup === "student" || targetGroup === "teacher"
          ? requestRows.filter((item: ActiveRequestRow) => item.targetGroup === targetGroup)
          : requestRows;

      const data: DocumentRequestItem[] = filteredRequestRows.map((item: ActiveRequestRow) => ({
        id: item.id,
        requestTypeId: item.requestTypeId,
        targetGroup: item.targetGroup as DocumentTargetGroup,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        requestType: {
          id: item.typeId,
          name: item.typeName,
          slug: item.typeSlug,
          description: item.typeDescription,
          createdAt: item.typeCreatedAt,
          updatedAt: item.typeUpdatedAt,
        },
      }));

      return c.json<SuccessResponse<DocumentRequestItem[]>>({
        success: true,
        message: "Document requests retrieved successfully",
        data,
      });
    } catch (err) {
      console.error("Error retrieving document requests:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve document requests" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.post(
  "/admin/requests",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      await ensureDocumentRequestSchema();
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const requestTypeId =
        typeof body?.requestTypeId === "string" ? body.requestTypeId.trim() : "";
      const targetGroup =
        body?.targetGroup === "teacher" ? "teacher" : "student";
      const isActive = body?.isActive !== false;

      if (!requestTypeId) {
        return c.json<ErrorResponse>(
          { success: false, error: "Document type is required" },
          HttpStatus.BadRequest,
        );
      }

      const existing = await db
        .select({ id: documentRequestsTable.id })
        .from(documentRequestsTable)
        .where(
          and(
            eq(documentRequestsTable.requestTypeId, requestTypeId),
            eq(documentRequestsTable.targetGroup, targetGroup),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error: "This document request already exists for the selected target group",
          },
          HttpStatus.Conflict,
        );
      }

      const [created] = await db
        .insert(documentRequestsTable)
        .values({
          requestTypeId,
          targetGroup,
          isActive,
        })
        .returning();

      return c.json<SuccessResponse<DocumentRequestItem>>(
        {
          success: true,
          message: "Document request created successfully",
          data: {
            ...created,
            targetGroup: created.targetGroup as DocumentTargetGroup,
            requestType: {
              id: requestTypeId,
              name: "",
              slug: "",
              description: null,
              createdAt: null,
              updatedAt: null,
            },
          },
        },
        HttpStatus.Created,
      );
    } catch (err) {
      console.error("Error creating document request:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create document request" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.put(
  "/admin/requests/:requestId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const requestId = c.req.param("requestId");

    try {
      await ensureDocumentRequestSchema();
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const requestTypeId =
        typeof body?.requestTypeId === "string" ? body.requestTypeId.trim() : "";
      const targetGroup =
        body?.targetGroup === "teacher" ? "teacher" : "student";
      const isActive = body?.isActive !== false;

      if (!requestTypeId) {
        return c.json<ErrorResponse>(
          { success: false, error: "Document type is required" },
          HttpStatus.BadRequest,
        );
      }

      const duplicate = await db
        .select({ id: documentRequestsTable.id })
        .from(documentRequestsTable)
        .where(
          and(
            eq(documentRequestsTable.requestTypeId, requestTypeId),
            eq(documentRequestsTable.targetGroup, targetGroup),
          ),
        )
        .limit(1);

      if (duplicate.length > 0 && duplicate[0].id !== requestId) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error: "This document request already exists for the selected target group",
          },
          HttpStatus.Conflict,
        );
      }

      const [updated] = await db
        .update(documentRequestsTable)
        .set({
          requestTypeId,
          targetGroup,
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(documentRequestsTable.id, requestId))
        .returning();

      if (!updated) {
        return c.json<ErrorResponse>(
          { success: false, error: "Document request not found" },
          HttpStatus.NotFound,
        );
      }

      return c.json<SuccessResponse<DocumentRequestItem>>({
        success: true,
        message: "Document request updated successfully",
        data: {
          ...updated,
          targetGroup: updated.targetGroup as DocumentTargetGroup,
          requestType: {
            id: requestTypeId,
            name: "",
            slug: "",
            description: null,
            createdAt: null,
            updatedAt: null,
          },
        },
      });
    } catch (err) {
      console.error("Error updating document request:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update document request" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.delete(
  "/admin/requests/:requestId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const requestId = c.req.param("requestId");

    try {
      await ensureDocumentRequestSchema();
      await db.delete(documentRequestsTable).where(eq(documentRequestsTable.id, requestId));
      return c.json<SuccessResponse>({
        success: true,
        message: "Document request deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting document request:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete document request" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.get(
  "/admin/tracking",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const targetGroup =
        c.req.query("targetGroup") === "teacher" ? "teacher" : "student";
      const search = c.req.query("search") ?? "";
      const payload = await resolveUserTrackingRows(targetGroup, search);

      return c.json<SuccessResponse<TrackingPayload>>({
        success: true,
        message: "Document tracking retrieved successfully",
        data: payload,
      });
    } catch (err) {
      console.error("Error retrieving document tracking:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve document tracking" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.get(
  "/admin/tracking/export",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const targetGroup =
        c.req.query("targetGroup") === "teacher" ? "teacher" : "student";
      const search = c.req.query("search") ?? "";
      const payload = await resolveUserTrackingRows(targetGroup, search);

      const lines = [
        ["Name", "Class/Role", "Document Type", "Document Status", "Uploaded At", "File Name"].join(","),
      ];

      for (const row of payload.rows) {
        for (const document of row.documents) {
          lines.push(
            [
              escapeCsvCell(row.fullName),
              escapeCsvCell(row.classOrRole),
              escapeCsvCell(document.typeName),
              escapeCsvCell(document.uploaded ? "Uploaded" : "Not Uploaded"),
              escapeCsvCell(document.uploadedAt ? new Date(document.uploadedAt).toISOString() : ""),
              escapeCsvCell(document.fileName),
            ].join(","),
          );
        }
      }

      c.header("Content-Type", "text/csv; charset=utf-8");
      c.header(
        "Content-Disposition",
        `attachment; filename="${targetGroup}-document-tracking.csv"`,
      );
      return c.body(lines.join("\n"));
    } catch (err) {
      console.error("Error exporting document tracking:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to export document tracking" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.get(
  "/admin/profiles/:userId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const userId = c.req.param("userId");

    try {
      await ensureDocumentRequestSchema();
      const allowed = await userHasManageableRole(userId);
      if (!allowed) {
        return c.json<ErrorResponse>(
          { success: false, error: "User is not a student or teacher" },
          HttpStatus.BadRequest,
        );
      }

      const userRows = await db
        .select({
          userId: usersTable.id,
          fullName: usersTable.fullName,
          username: usersTable.username,
          avatarUrl: usersTable.avatarUrl,
          studentId: studentsTable.id,
          className: classesTable.name,
          admissionNo: studentsTable.admissionNo,
          rollNumber: studentsTable.rollNumber,
          mobileNo: teachersTable.mobileNo,
          designation: teachersTable.designation,
          qualification: teachersTable.qualification,
        })
        .from(usersTable)
        .leftJoin(studentsTable, eq(studentsTable.userId, usersTable.id))
        .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .leftJoin(teachersTable, eq(teachersTable.userId, usersTable.id))
        .where(eq(usersTable.id, userId))
        .limit(1);

      const user = userRows[0];
      if (!user) {
        return c.json<ErrorResponse>(
          { success: false, error: "User not found" },
          HttpStatus.NotFound,
        );
      }

      const targetGroup: DocumentTargetGroup = user.studentId ? "student" : "teacher";
      const tracking = await resolveUserTrackingRows(targetGroup, "");
      const trackingRow = tracking.rows.find((item) => item.userId === userId);

      const allDocs = await db
        .select()
        .from(documentsTable)
        .where(eq(documentsTable.userId, userId))
        .orderBy(desc(documentsTable.uploadedAt));

      const requiredRequestTypeIds = new Set(
        (trackingRow?.documents ?? []).map((item: TrackingDocument) => item.requestTypeId),
      );
      const otherDocuments = allDocs.filter((doc: DocumentItem) => {
        if (doc.requestTypeId && requiredRequestTypeIds.has(doc.requestTypeId)) {
          return false;
        }
        return !(trackingRow?.documents ?? []).some(
          (item: TrackingDocument) => item.typeSlug === doc.documentType,
        );
      });

      const payload: ProfilePayload = {
        user: {
          userId: user.userId,
          fullName: user.fullName,
          username: user.username,
          avatarUrl: user.avatarUrl,
          targetGroup,
          classOrRole:
            targetGroup === "student"
              ? user.className || "Unassigned class"
              : user.designation || "Teacher",
          className: user.className,
          roleLabel: user.designation,
          admissionNo: user.admissionNo,
          rollNumber: user.rollNumber,
          mobileNo: user.mobileNo,
          designation: user.designation,
          qualification: user.qualification,
        },
        requiredDocuments: trackingRow?.documents ?? [],
        otherDocuments,
      };

      return c.json<SuccessResponse<ProfilePayload>>({
        success: true,
        message: "Document profile retrieved successfully",
        data: payload,
      });
    } catch (err) {
      console.error("Error retrieving document profile:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve document profile" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

documentRouter.get(
  "/admin/users",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      await ensureDocumentRequestSchema();
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
          avatarUrl: usersTable.avatarUrl,
          role: rolesTable.name,
          studentId: studentsTable.id,
          classId: studentsTable.classId,
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
      await ensureDocumentRequestSchema();
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
        .where(eq(documentsTable.userId, userId))
        .orderBy(desc(documentsTable.uploadedAt));

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
      await ensureDocumentRequestSchema();
      const allowed = await userHasManageableRole(userId);
      if (!allowed) {
        return c.json<ErrorResponse>(
          { success: false, error: "User is not a student or teacher" },
          HttpStatus.BadRequest,
        );
      }

      const body = await c.req.parseBody({ all: true });
      const files = toFileArray(body.files);
      const requestTypeId =
        typeof body.requestTypeId === "string" && body.requestTypeId.trim()
          ? body.requestTypeId.trim()
          : null;
      let rawDocumentType =
        typeof body.documentType === "string"
          ? normalizeDocumentSlug(body.documentType.trim())
          : "";

      if (requestTypeId) {
        const type = await db
          .select()
          .from(documentRequestTypesTable)
          .where(eq(documentRequestTypesTable.id, requestTypeId))
          .limit(1);

        if (type.length > 0) {
          rawDocumentType = type[0].slug;
        }
      }

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
        requestTypeId,
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

documentRouter.patch(
  "/admin/users/:userId/documents/:documentId/status",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const userId = c.req.param("userId");
    const documentId = c.req.param("documentId");

    try {
      await ensureDocumentRequestSchema();
      const allowed = await userHasManageableRole(userId);
      if (!allowed) {
        return c.json<ErrorResponse>(
          { success: false, error: "User is not a student or teacher" },
          HttpStatus.BadRequest,
        );
      }

      const body = await c.req.json().catch(() => ({}));
      const nextStatus =
        typeof body?.status === "string"
          ? sanitizeDocumentStatus(body.status)
          : null;

      if (!nextStatus) {
        return c.json<ErrorResponse>(
          { success: false, error: "Please select a valid document status" },
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

      const [updatedDoc] = await db
        .update(documentsTable)
        .set({
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(documentsTable.id, documentId))
        .returning();

      return c.json<SuccessResponse<DocumentItem>>({
        success: true,
        message: "Document status updated successfully",
        data: updatedDoc,
      });
    } catch (err) {
      console.error("Error updating document status:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update document status" },
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
      await ensureDocumentRequestSchema();
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
