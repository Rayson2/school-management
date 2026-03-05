import { Hono } from "hono";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { Role } from "../utils/roles";
import { db } from "../db";
import { Student, studentsTable } from "../db/schemas/students";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";
import {
  validateStudentData,
  validateStudentUpdateData,
} from "../middlewares/student.middleware";
import { usersTable } from "../db/schemas/users";
import { hashSync } from "bcryptjs";
import { rolesTable, userRolesTable } from "../db/schemas/roles";
import { and, eq, ilike, or } from "drizzle-orm";
import { documentsTable } from "../db/schemas/documents";
import { classesTable } from "../db/schemas/classes";
import { academicSessionsTable } from "../db/schemas/academicSessions";
import { mkdir, unlink } from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";

const studentRouter = new Hono();
type StudentWithUser = Student & {
  fullName: string;
  username: string;
  avatarUrl: string | null;
  sessionName: string;
  className: string;
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

const studentWithUserSelect = {
  id: studentsTable.id,
  userId: studentsTable.userId,
  sessionId: studentsTable.sessionId,
  classId: studentsTable.classId,
  rollNumber: studentsTable.rollNumber,
  enrollmentNo: studentsTable.enrollmentNo,
  admissionNo: studentsTable.admissionNo,
  admissionDate: studentsTable.admissionDate,
  fathersName: studentsTable.fathersName,
  mothersName: studentsTable.mothersName,
  sessionName: academicSessionsTable.name,
  className: classesTable.name,
  parentEmail: studentsTable.parentEmail,
  parentPhone: studentsTable.parentPhone,
  dateOfBirth: studentsTable.dateOfBirth,
  bloodGroup: studentsTable.bloodGroup,
  gender: studentsTable.gender,
  penNo: studentsTable.penNo,
  aadharNo: studentsTable.aadharNo,
  category: studentsTable.category,
  aaparId: studentsTable.aaparId,
  address: studentsTable.address,
  mobileNo: studentsTable.mobileNo,
  createdAt: studentsTable.createdAt,
  updatedAt: studentsTable.updatedAt,
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

const getFirstNameCode = (fullName: string) => {
  const firstName = fullName.trim().split(/\s+/)[0] ?? "";
  const letters = firstName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "USR").padEnd(3, "X");
};

const buildDefaultPassword = (fullName: string, dateOfBirth: string) => {
  const year = new Date(dateOfBirth).getFullYear();
  const safeYear = Number.isNaN(year) ? "0000" : String(year);
  return `${getFirstNameCode(fullName)}${safeYear}`;
};

const normalizeEnrollmentPrefix = (value: string | null | undefined) => {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized || "ENR";
};

const getNextEnrollmentNo = async (
  tx: any,
  sessionId: string,
  enrollmentPrefix: string,
) => {
  const prefix = normalizeEnrollmentPrefix(enrollmentPrefix);
  const rows = await tx
    .select({ enrollmentNo: studentsTable.enrollmentNo })
    .from(studentsTable)
    .where(
      and(
        eq(studentsTable.sessionId, sessionId),
        ilike(studentsTable.enrollmentNo, `${prefix}%`),
      ),
    );

  let maxSuffix = 0;
  for (const row of rows) {
    const value = (row.enrollmentNo ?? "").trim();
    if (!value.startsWith(prefix)) continue;
    const suffixRaw = value.slice(prefix.length).replace(/\D/g, "");
    const suffix = Number(suffixRaw);
    if (Number.isFinite(suffix) && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  }

  return `${prefix}${String(maxSuffix + 1).padStart(4, "0")}`;
};

const resolveClassId = async (
  tx: any,
  payload: { classId?: string; className?: string },
) => {
  if (payload.classId) {
    const existingClass = await tx
      .select({ id: classesTable.id })
      .from(classesTable)
      .where(eq(classesTable.id, payload.classId))
      .limit(1);

    if (!existingClass.length) {
      throw { type: "bad_request", message: "Class not found" };
    }

    return existingClass[0].id;
  }

  const className = payload.className?.trim();
  if (!className) {
    throw { type: "bad_request", message: "Class is required" };
  }

  const existingByName = await tx
    .select({ id: classesTable.id })
    .from(classesTable)
    .where(eq(classesTable.name, className))
    .limit(1);

  if (existingByName.length) {
    return existingByName[0].id;
  }

  throw { type: "bad_request", message: "Class not found" };
};

const resolveSessionId = async (
  tx: any,
  payload: { sessionId?: string; sessionName?: string },
) => {
  if (payload.sessionId) {
    const existingSession = await tx
      .select({
        id: academicSessionsTable.id,
        enrollmentPrefix: academicSessionsTable.enrollmentPrefix,
      })
      .from(academicSessionsTable)
      .where(eq(academicSessionsTable.id, payload.sessionId))
      .limit(1);

    if (!existingSession.length) {
      throw { type: "bad_request", message: "Academic session not found" };
    }

    return {
      id: existingSession[0].id,
      enrollmentPrefix: normalizeEnrollmentPrefix(
        existingSession[0].enrollmentPrefix,
      ),
    };
  }

  const sessionName = payload.sessionName?.trim();
  if (!sessionName) {
    throw { type: "bad_request", message: "Academic session is required" };
  }

  const existingByName = await tx
    .select({
      id: academicSessionsTable.id,
      enrollmentPrefix: academicSessionsTable.enrollmentPrefix,
    })
    .from(academicSessionsTable)
    .where(eq(academicSessionsTable.name, sessionName))
    .limit(1);

  if (existingByName.length) {
    return {
      id: existingByName[0].id,
      enrollmentPrefix: normalizeEnrollmentPrefix(
        existingByName[0].enrollmentPrefix,
      ),
    };
  }

  throw { type: "bad_request", message: "Academic session not found" };
};

studentRouter.get(
  "/all",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const sessionId = c.req.query("sessionId");

    const result = await db
      .select(studentWithUserSelect)
      .from(studentsTable)
      .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .innerJoin(
        academicSessionsTable,
        eq(studentsTable.sessionId, academicSessionsTable.id),
      )
      .where(sessionId ? eq(studentsTable.sessionId, sessionId) : undefined);

    return c.json<SuccessResponse<StudentWithUser[]>>({
      success: true,
      message: "Students retrieved successfully",
      data: result,
    });
  },
);

studentRouter.get(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const studentId = c.req.param("id");

    const student = await db
      .select(studentWithUserSelect)
      .from(studentsTable)
      .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .innerJoin(
        academicSessionsTable,
        eq(studentsTable.sessionId, academicSessionsTable.id),
      )
      .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .where(eq(studentsTable.id, studentId))
      .limit(1);

    if (student.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Student not found" },
        HttpStatus.NotFound,
      );
    }

    return c.json<SuccessResponse<StudentWithUser>>({
      success: true,
      message: "Student retrieved successfully",
      data: student[0],
    });
  },
);

studentRouter.get(
  "/lookup/:identifier",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const identifier = c.req.param("identifier").trim();

    if (!identifier) {
      return c.json<ErrorResponse>(
        { success: false, error: "Identifier is required" },
        HttpStatus.BadRequest,
      );
    }

    const result = await db
      .select(studentWithUserSelect)
      .from(studentsTable)
      .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .innerJoin(
        academicSessionsTable,
        eq(studentsTable.sessionId, academicSessionsTable.id),
      )
      .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .where(
        or(
          eq(studentsTable.admissionNo, identifier),
          eq(studentsTable.enrollmentNo, identifier),
          eq(studentsTable.rollNumber, identifier),
          eq(usersTable.username, identifier),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Student not found" },
        HttpStatus.NotFound,
      );
    }

    return c.json<SuccessResponse<StudentWithUser>>({
      success: true,
      message: "Student resolved successfully",
      data: result[0],
    });
  },
);

studentRouter.post(
  "/add",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateStudentData,
  async (c) => {
    const studentData = c.req.valid("json");
    const generatedUsername = studentData.admissionNo.trim();
    const generatedPassword = buildDefaultPassword(
      studentData.fullName,
      studentData.dateOfBirth,
    );

    try {
      const newStudent = await db.transaction(async (tx) => {
        const session = await resolveSessionId(tx, {
          sessionId: studentData.sessionId,
          sessionName: studentData.sessionName,
        });

        const classId = await resolveClassId(tx, {
          classId: studentData.classId,
          className: studentData.className,
        });
        const requestedEnrollmentNo = studentData.enrollmentNo?.trim() || "";
        if (requestedEnrollmentNo) {
          const enrollmentOwner = await tx
            .select({ id: studentsTable.id })
            .from(studentsTable)
            .where(eq(studentsTable.enrollmentNo, requestedEnrollmentNo))
            .limit(1);
          if (enrollmentOwner.length > 0) {
            throw {
              type: "conflict",
              message: `Student with this enrollment number ${requestedEnrollmentNo} already exists`,
            };
          }
        }

        // Check if username already exists (inside transaction)
        const existingUser = await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, generatedUsername))
          .limit(1);

        if (existingUser.length > 0) {
          throw {
            type: "conflict",
            message: `Student with this admission number ${generatedUsername} already exists`,
          };
        }

        // Create New User
        const [newUser] = await tx
          .insert(usersTable)
          .values({
            fullName: studentData.fullName,
            username: generatedUsername,
            password: hashSync(generatedPassword, 12),
          })
          .returning();

        // Fetch student role
        const [studentRole] = await tx
          .select()
          .from(rolesTable)
          .where(eq(rolesTable.name, Role.STUDENT))
          .limit(1);

        if (studentRole) {
          await tx.insert(userRolesTable).values({
            userId: newUser.id,
            roleId: studentRole.id,
          });
        }

        const [createdStudent] = await tx
          .insert(studentsTable)
          .values({
            userId: newUser.id,
            rollNumber:
              (studentData.rollNumber?.trim() || studentData.admissionNo.trim()),
            enrollmentNo:
              requestedEnrollmentNo ||
              (await getNextEnrollmentNo(
                tx,
                session.id,
                session.enrollmentPrefix,
              )),
            admissionNo: studentData.admissionNo,
            classId,
            sessionId: session.id,
            dateOfBirth: new Date(studentData.dateOfBirth),
            admissionDate: new Date(studentData.admissionDate),
            mobileNo: studentData.mobileNo,
            address: studentData.address,
            gender: studentData.gender,
            category: studentData.category,
            aadharNo: studentData.aadharNo,
            aaparId: studentData.aaparId,
            fathersName: studentData.fathersName,
            mothersName: studentData.mothersName,
            parentPhone: studentData.parentPhone,
            parentEmail: studentData.parentEmail,
            bloodGroup: studentData.bloodGroup,
            penNo: studentData.penNo,
          })
          .returning();

        return createdStudent;
      });

      return c.json<
        SuccessResponse<{
          student: Student;
          credentials: { username: string; password: string };
        }>
      >({
        success: true,
        message: "Student added successfully",
        data: {
          student: newStudent,
          credentials: {
            username: generatedUsername,
            password: generatedPassword,
          },
        },
      });
    } catch (err: any) {
      if (err && err.type === "conflict") {
        return c.json<ErrorResponse>({ success: false, error: err.message }, HttpStatus.Conflict);
      }
      if (err?.type === "bad_request") {
        return c.json<ErrorResponse>({ success: false, error: err.message }, HttpStatus.BadRequest);
      }
      console.error("Error adding student:", err);
      return c.json<ErrorResponse>({ success: false, error: "Failed to add student" }, HttpStatus.InternalServerError);
    }
  },
);

studentRouter.put(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateStudentUpdateData,
  async (c) => {
    const studentId = c.req.param("id");
    const studentData = c.req.valid("json");
    const generatedUsername = studentData.admissionNo.trim();

    try {
      const updatedStudent = await db.transaction(async (tx) => {
        const session = await resolveSessionId(tx, {
          sessionId: studentData.sessionId,
          sessionName: studentData.sessionName,
        });

        const classId = await resolveClassId(tx, {
          classId: studentData.classId,
          className: studentData.className,
        });

        const existingStudent = await tx
          .select({
            id: studentsTable.id,
            userId: studentsTable.userId,
            enrollmentNo: studentsTable.enrollmentNo,
          })
          .from(studentsTable)
          .where(eq(studentsTable.id, studentId))
          .limit(1);

        if (existingStudent.length === 0) {
          throw { type: "not_found", message: "Student not found" };
        }

        const studentRecord = existingStudent[0];

        const requestedEnrollmentNo = studentData.enrollmentNo?.trim() ?? "";
        let nextEnrollmentNo =
          requestedEnrollmentNo || existingStudent[0].enrollmentNo || "";
        if (!nextEnrollmentNo) {
          nextEnrollmentNo = await getNextEnrollmentNo(
            tx,
            session.id,
            session.enrollmentPrefix,
          );
        }

        const enrollmentOwner = await tx
          .select({ id: studentsTable.id })
          .from(studentsTable)
          .where(eq(studentsTable.enrollmentNo, nextEnrollmentNo))
          .limit(1);
        if (
          enrollmentOwner.length > 0 &&
          enrollmentOwner[0].id !== existingStudent[0].id
        ) {
          throw {
            type: "conflict",
            message: `Student with this enrollment number ${nextEnrollmentNo} already exists`,
          };
        }

        const usernameOwner = await tx
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.username, generatedUsername))
          .limit(1);

        if (usernameOwner.length > 0 && usernameOwner[0].id !== studentRecord.userId) {
          throw {
            type: "conflict",
            message: `Student with this admission number ${generatedUsername} already exists`,
          };
        }

        const userUpdateData: { fullName: string; username: string } = {
          fullName: studentData.fullName,
          username: generatedUsername,
        };

        await tx
          .update(usersTable)
          .set(userUpdateData)
          .where(eq(usersTable.id, studentRecord.userId));

        await tx
          .update(studentsTable)
          .set({
            rollNumber:
              (studentData.rollNumber?.trim() || studentData.admissionNo.trim()),
            enrollmentNo: nextEnrollmentNo,
            admissionNo: studentData.admissionNo,
            admissionDate: new Date(studentData.admissionDate),
            fathersName: studentData.fathersName,
            mothersName: studentData.mothersName,
            sessionId: session.id,
            classId,
            parentEmail: studentData.parentEmail,
            parentPhone: studentData.parentPhone,
            dateOfBirth: new Date(studentData.dateOfBirth),
            bloodGroup: studentData.bloodGroup,
            gender: studentData.gender,
            penNo: studentData.penNo,
            aadharNo: studentData.aadharNo,
            category: studentData.category,
            aaparId: studentData.aaparId,
            address: studentData.address,
            mobileNo: studentData.mobileNo,
          })
          .where(eq(studentsTable.id, studentId));

        const student = await tx
          .select(studentWithUserSelect)
          .from(studentsTable)
          .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
          .innerJoin(
            academicSessionsTable,
            eq(studentsTable.sessionId, academicSessionsTable.id),
          )
          .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
          .where(eq(studentsTable.id, studentId))
          .limit(1);

        return student[0];
      });

      return c.json<SuccessResponse<StudentWithUser>>({
        success: true,
        message: "Student updated successfully",
        data: updatedStudent,
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
      if (err?.type === "bad_request") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.BadRequest,
        );
      }
      console.error("Error updating student:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update student" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

studentRouter.post(
  "/:id/change-password",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const studentId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword.trim() : "";

    if (!newPassword) {
      return c.json<ErrorResponse>(
        { success: false, error: "New password is required" },
        HttpStatus.BadRequest,
      );
    }

    try {
      const student = await db
        .select({
          id: studentsTable.id,
          userId: studentsTable.userId,
        })
        .from(studentsTable)
        .where(eq(studentsTable.id, studentId))
        .limit(1);

      if (student.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Student not found" },
          HttpStatus.NotFound,
        );
      }

      await db
        .update(usersTable)
        .set({
          password: hashSync(newPassword, 12),
        })
        .where(eq(usersTable.id, student[0].userId));

      return c.json<SuccessResponse>({
        success: true,
        message: "Student password changed successfully",
      });
    } catch (err) {
      console.error("Error changing student password:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to change student password" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

studentRouter.post(
  "/:id/profile-pic",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const studentId = c.req.param("id");

    try {
      const student = await db
        .select({
          id: studentsTable.id,
          userId: studentsTable.userId,
          admissionNo: studentsTable.admissionNo,
          rollNumber: studentsTable.rollNumber,
        })
        .from(studentsTable)
        .where(eq(studentsTable.id, studentId))
        .limit(1);

      if (!student.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Student not found" },
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

      const studentIdentifier = sanitizePathSegment(
        student[0].admissionNo || student[0].rollNumber || student[0].id,
      );
      const studentUploadDir = path.join(uploadRootDir, studentIdentifier);
      await mkdir(studentUploadDir, { recursive: true });

      const extension = getExtension(file.name) || ".jpg";
      const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
      const finalPath = path.join(studentUploadDir, savedFileName);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      await Bun.write(finalPath, fileBuffer);

      const avatarUrl = `/api/upload/${studentIdentifier}/${savedFileName}`;
      const existingUser = await db
        .select({ avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(eq(usersTable.id, student[0].userId))
        .limit(1);
      const previousAvatarUrl = existingUser[0]?.avatarUrl ?? null;

      await db
        .update(usersTable)
        .set({ avatarUrl })
        .where(eq(usersTable.id, student[0].userId));

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
      console.error("Error uploading student profile picture:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to upload profile picture" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

studentRouter.get(
  "/:id/documents",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const studentId = c.req.param("id");

    try {
      const student = await db
        .select({
          id: studentsTable.id,
          userId: studentsTable.userId,
        })
        .from(studentsTable)
        .where(eq(studentsTable.id, studentId))
        .limit(1);

      if (student.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Student not found" },
          HttpStatus.NotFound,
        );
      }

      const docs = await db
        .select()
        .from(documentsTable)
        .where(eq(documentsTable.userId, student[0].userId));

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

studentRouter.post(
  "/:id/documents",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const studentId = c.req.param("id");

    try {
      const student = await db
        .select({
          id: studentsTable.id,
          userId: studentsTable.userId,
          admissionNo: studentsTable.admissionNo,
          rollNumber: studentsTable.rollNumber,
        })
        .from(studentsTable)
        .where(eq(studentsTable.id, studentId))
        .limit(1);

      if (student.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Student not found" },
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

      const studentIdentifier = sanitizePathSegment(
        student[0].admissionNo || student[0].rollNumber || student[0].id,
      );
      const studentUploadDir = path.join(uploadRootDir, studentIdentifier);
      await mkdir(studentUploadDir, { recursive: true });

      const insertedDocs: DocumentItem[] = [];

      for (const file of files) {
        if (!file.name || file.size === 0) continue;

        const extension = getExtension(file.name);
        const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
        const finalPath = path.join(studentUploadDir, savedFileName);

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await Bun.write(finalPath, fileBuffer);

        const inferredType = rawDocumentType || inferDocumentTypeFromFileName(file.name);
        const [createdDoc] = await db
          .insert(documentsTable)
          .values({
            userId: student[0].userId,
            fileName: file.name,
            fileUrl: `/api/upload/${studentIdentifier}/${savedFileName}`,
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

studentRouter.delete(
  "/:id/documents/:documentId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const studentId = c.req.param("id");
    const documentId = c.req.param("documentId");

    try {
      const student = await db
        .select({
          id: studentsTable.id,
          userId: studentsTable.userId,
        })
        .from(studentsTable)
        .where(eq(studentsTable.id, studentId))
        .limit(1);

      if (student.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Student not found" },
          HttpStatus.NotFound,
        );
      }

      const doc = await db
        .select()
        .from(documentsTable)
        .where(
          and(
            eq(documentsTable.id, documentId),
            eq(documentsTable.userId, student[0].userId),
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

studentRouter.delete(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const studentId = c.req.param("id");

    try {
      const filesToDelete: string[] = [];
      await db.transaction(async (tx) => {
        const student = await tx
          .select({
            id: studentsTable.id,
            userId: studentsTable.userId,
            avatarUrl: usersTable.avatarUrl,
          })
          .from(studentsTable)
          .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
          .where(eq(studentsTable.id, studentId))
          .limit(1);

        if (student.length === 0) {
          throw { type: "not_found", message: "Student not found" };
        }

        const docs = await tx
          .select({ fileUrl: documentsTable.fileUrl })
          .from(documentsTable)
          .where(eq(documentsTable.userId, student[0].userId));

        filesToDelete.push(...docs.map((doc) => doc.fileUrl));
        if (student[0].avatarUrl) {
          filesToDelete.push(student[0].avatarUrl);
        }

        await tx
          .delete(documentsTable)
          .where(eq(documentsTable.userId, student[0].userId));

        await tx.delete(studentsTable).where(eq(studentsTable.id, studentId));

        await tx
          .delete(usersTable)
          .where(eq(usersTable.id, student[0].userId));
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
        message: "Student deleted successfully",
      });
    } catch (err: any) {
      if (err?.type === "not_found") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.NotFound,
        );
      }
      console.error("Error deleting student:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete student" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default studentRouter;
