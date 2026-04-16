import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { and, eq, ilike, inArray, ne } from "drizzle-orm";
import z from "zod";
import { db } from "../db";
import { academicSessionsTable } from "../db/schemas/academicSessions";
import { classesTable } from "../db/schemas/classes";
import {
  classSubjectsTable,
  examMarksControlsTable,
  examsTable,
  examSubjectComponentsTable,
  examSubjectsTable,
  studentExamEnrollmentsTable,
  subjectsTable,
} from "../db/schemas/exams";
import { studentMarksTable } from "../db/schemas/marks";
import { studentsTable } from "../db/schemas/students";
import { teachersTable } from "../db/schemas/teachers";
import { usersTable } from "../db/schemas/users";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import {
  validateAssignClassSubject,
  validateCreateExam,
  validateCreateMultiClassExam,
  validateCreateSubject,
  validateEnrollStudents,
  validateUpdateClassSubject,
  validateUpdateExamComponentMarks,
  validateUpdateExam,
} from "../middlewares/exam.middleware";
import {
  validateBulkUpdateMarks,
  validateEnterMarks,
  validateUpdateMark,
} from "../middlewares/marks.middleware";
import { Role } from "../utils/roles";
import {
  COMPONENT_LABELS,
  EXAM_TYPE_LABELS,
  type ExamType,
  getComponentMarks,
  getComponentsForExamType,
} from "../utils/exam-structure";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";

const examRouter = new Hono();

const examIdParamSchema = z.object({
  examId: z.string().uuid(),
});

const marksControlUpdateSchema = z.object({
  mode: z.enum(["closed", "open"]),
});

const toDateOrUndefined = (value?: string) => {
  if (!value) return undefined;
  return new Date(value);
};

const isUniqueViolationError = (err: unknown) => {
  if (!err || typeof err !== "object") return false;
  const maybeErr = err as {
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  };
  return (
    maybeErr.code === "23505" ||
    maybeErr.cause?.code === "23505" ||
    `${maybeErr.message || ""} ${maybeErr.cause?.message || ""}`
      .toLowerCase()
      .includes("unique")
  );
};

const createSubject = async (payload: {
  sessionId: string;
  name: string;
  code: string;
  subjectType?: "theory" | "practical" | "activity";
}) => {
  const existingByName = await db
    .select({ id: subjectsTable.id })
    .from(subjectsTable)
    .where(
      and(
        eq(subjectsTable.sessionId, payload.sessionId),
        ilike(subjectsTable.name, payload.name),
      ),
    )
    .limit(1);

  if (existingByName.length) {
    return {
      ok: false as const,
      status: HttpStatus.Conflict,
      error: "Subject name already exists in this session",
    };
  }

  const existingByCode = await db
    .select({ id: subjectsTable.id })
    .from(subjectsTable)
    .where(eq(subjectsTable.code, payload.code))
    .limit(1);

  if (existingByCode.length) {
    return {
      ok: false as const,
      status: HttpStatus.Conflict,
      error: "Subject code already exists",
    };
  }

  try {
    const [subject] = await db
      .insert(subjectsTable)
      .values(payload)
      .returning();
    return { ok: true as const, subject };
  } catch (err) {
    if (isUniqueViolationError(err)) {
      return {
        ok: false as const,
        status: HttpStatus.Conflict,
        error: "Subject already exists",
      };
    }
    console.error("Error creating subject:", err);
    return {
      ok: false as const,
      status: HttpStatus.InternalServerError,
      error: "Failed to create subject",
    };
  }
};

const getTeacherProfileId = async (userId: string) => {
  const rows = await db
    .select({ id: teachersTable.id })
    .from(teachersTable)
    .where(eq(teachersTable.userId, userId))
    .limit(1);
  return rows[0]?.id;
};

const getMarksControlMode = async (examId: string) => {
  const rows = await db
    .select({ mode: examMarksControlsTable.mode })
    .from(examMarksControlsTable)
    .where(eq(examMarksControlsTable.examId, examId))
    .limit(1);

  return rows[0]?.mode ?? "closed";
};

const ensureTeacherMarksEntryAccess = async (userRoles: string[], examId: string) => {
  if (userRoles.includes(Role.ADMIN)) return null;

  const mode = await getMarksControlMode(examId);
  if (mode === "open") return null;

  return {
    success: false,
    error: "Marks entry is currently closed for this class. Contact admin to open it.",
  } satisfies ErrorResponse;
};

const createExamSubjectsAndComponents = async (
  tx: any,
  payload: {
    examId: string;
    sessionId: string;
    classId: string;
    examType: ExamType;
    subjectScheduleById?: Map<
      string,
      {
        examDate: Date;
        startTime: Date;
        endTime: Date;
      }
    >;
  },
) => {
  const classSubjects = await tx
    .select({ subjectId: classSubjectsTable.subjectId })
    .from(classSubjectsTable)
    .where(
      and(
        eq(classSubjectsTable.sessionId, payload.sessionId),
        eq(classSubjectsTable.classId, payload.classId),
      ),
    );

  if (!classSubjects.length) {
    throw {
      type: "bad_request",
      message:
        "No class subjects mapped for selected class/session. Assign class subjects first.",
    };
  }

  const components = getComponentsForExamType(payload.examType);

  for (const classSubject of classSubjects) {
    const subjectComponents = components.map((component) => ({
      component,
      ...getComponentMarks(component),
    }));

    const [examSubject] = await tx
      .insert(examSubjectsTable)
      .values({
        examId: payload.examId,
        subjectId: classSubject.subjectId,
        maxMarks: subjectComponents.reduce((sum, item) => sum + item.maxMarks, 0),
        passMarks: subjectComponents.reduce((sum, item) => sum + item.passMarks, 0),
        examDate: payload.subjectScheduleById?.get(classSubject.subjectId)?.examDate,
        startTime: payload.subjectScheduleById?.get(classSubject.subjectId)?.startTime,
        endTime: payload.subjectScheduleById?.get(classSubject.subjectId)?.endTime,
      })
      .returning();

    await tx.insert(examSubjectComponentsTable).values(
      subjectComponents.map((item) => ({
        examSubjectId: examSubject.id,
        component: item.component,
        maxMarks: item.maxMarks,
        passMarks: item.passMarks,
      })),
    );
  }
};

examRouter.post(
  "/create-multi-class",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateCreateMultiClassExam,
  async (c) => {
    const body = c.req.valid("json");
    const user = (c as any).get("user") as { id: string };

    try {
      const created = await db.transaction(async (tx) => {
        const examGroupId = crypto.randomUUID();
        const [session] = await tx
          .select({ id: academicSessionsTable.id, name: academicSessionsTable.name })
          .from(academicSessionsTable)
          .where(eq(academicSessionsTable.id, body.sessionId))
          .limit(1);

        if (!session) {
          throw { type: "bad_request", message: "Academic session not found" };
        }

        const classIds = body.classes.map((item) => item.classId);
        const classes = await tx
          .select({ id: classesTable.id })
          .from(classesTable)
          .where(inArray(classesTable.id, classIds));
        const existingClassIds = new Set(classes.map((row) => row.id));
        const missingClassId = classIds.find((classId) => !existingClassIds.has(classId));
        if (missingClassId) {
          throw { type: "bad_request", message: "One or more classes were not found" };
        }

        const existingExamRows = await tx
          .select({ id: examsTable.id })
          .from(examsTable)
          .where(
            and(
              eq(examsTable.sessionId, body.sessionId),
              eq(examsTable.examType, body.examType),
            ),
          );
        if (existingExamRows.length) {
          throw {
            type: "conflict",
            message:
              "This exam type is already created in this academic session",
          };
        }

        const createdExams = [];
        for (const classItem of body.classes) {
          const subjectScheduleById = new Map(
            (classItem.subjects ?? []).map((subject) => [
              subject.subjectId,
              {
                examDate: new Date(`${subject.examDate}T00:00:00.000Z`),
                startTime: new Date(subject.startTime),
                endTime: new Date(subject.endTime),
              },
            ]),
          );

          if (subjectScheduleById.size) {
            const classSubjectRows = await tx
              .select({ subjectId: classSubjectsTable.subjectId })
              .from(classSubjectsTable)
              .where(
                and(
                  eq(classSubjectsTable.sessionId, body.sessionId),
                  eq(classSubjectsTable.classId, classItem.classId),
                ),
              );
            const classSubjectSet = new Set(classSubjectRows.map((row) => row.subjectId));
            const invalidSubjectId = Array.from(subjectScheduleById.keys()).find(
              (subjectId) => !classSubjectSet.has(subjectId),
            );
            if (invalidSubjectId) {
              throw {
                type: "bad_request",
                message:
                  "One or more subjects are not assigned to the selected class/session",
              };
            }
          }

          const [exam] = await tx
            .insert(examsTable)
            .values({
              sessionId: body.sessionId,
              examGroupId,
              classId: classItem.classId,
              name: EXAM_TYPE_LABELS[body.examType],
              examType: body.examType,
              description: body.description,
              academicYear: body.academicYear ?? session.name,
              startDate: toDateOrUndefined(classItem.startDate),
              endDate: toDateOrUndefined(classItem.endDate),
              status: body.status ?? "draft",
              createdBy: user.id,
            })
            .returning();

          await createExamSubjectsAndComponents(tx, {
            examId: exam.id,
            sessionId: body.sessionId,
            classId: classItem.classId,
            examType: body.examType,
            subjectScheduleById,
          });

          if (body.autoEnrollStudents) {
            const classStudents = await tx
              .select({ id: studentsTable.id })
              .from(studentsTable)
              .where(
                and(
                  eq(studentsTable.sessionId, body.sessionId),
                  eq(studentsTable.classId, classItem.classId),
                ),
              );

            if (classStudents.length) {
              await tx
                .insert(studentExamEnrollmentsTable)
                .values(
                  classStudents.map((student) => ({
                    examId: exam.id,
                    studentId: student.id,
                  })),
                )
                .onConflictDoNothing();
            }
          }

          createdExams.push(exam);
        }

        return createdExams;
      });

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Multi-class exam schedule created successfully",
          data: created,
        },
        HttpStatus.Created,
      );
    } catch (err: any) {
      if (err?.type === "bad_request") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.BadRequest,
        );
      }
      if (err?.type === "conflict") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.Conflict,
        );
      }
      if (isUniqueViolationError(err)) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error:
              "This exam type is already created in this academic session",
          },
          HttpStatus.Conflict,
        );
      }
      console.error("Error creating multi-class exam schedule:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create multi-class exam schedule" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.get(
  "/sessions/all",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    try {
      const rows = await db
        .select({
          id: academicSessionsTable.id,
          name: academicSessionsTable.name,
          createdAt: academicSessionsTable.createdAt,
          updatedAt: academicSessionsTable.updatedAt,
        })
        .from(academicSessionsTable);

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

examRouter.get(
  "/subjects/all",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const sessionId = c.req.query("sessionId");
    try {
      const rows = await db
        .select()
        .from(subjectsTable)
        .where(sessionId ? eq(subjectsTable.sessionId, sessionId) : undefined);
      return c.json<SuccessResponse>({
        success: true,
        message: "Subjects retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error retrieving subjects:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve subjects" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.get(
  "/subject/all",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const sessionId = c.req.query("sessionId");
    try {
      const rows = await db
        .select()
        .from(subjectsTable)
        .where(sessionId ? eq(subjectsTable.sessionId, sessionId) : undefined);
      return c.json<SuccessResponse>({
        success: true,
        message: "Subjects retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error retrieving subjects:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve subjects" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.post(
  "/subjects/create",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateCreateSubject,
  async (c) => {
    const body = c.req.valid("json");

    const session = await db
      .select({ id: academicSessionsTable.id })
      .from(academicSessionsTable)
      .where(eq(academicSessionsTable.id, body.sessionId))
      .limit(1);

    if (!session.length) {
      return c.json<ErrorResponse>(
        { success: false, error: "Academic session not found" },
        HttpStatus.BadRequest,
      );
    }

    const result = await createSubject(body);
    if (!result.ok) {
      return c.json<ErrorResponse>(
        { success: false, error: result.error },
        result.status as any,
      );
    }

    return c.json<SuccessResponse>(
      {
        success: true,
        message: "Subject created successfully",
        data: result.subject,
      },
      HttpStatus.Created,
    );
  },
);

examRouter.post(
  "/subject/create",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateCreateSubject,
  async (c) => {
    const body = c.req.valid("json");

    const session = await db
      .select({ id: academicSessionsTable.id })
      .from(academicSessionsTable)
      .where(eq(academicSessionsTable.id, body.sessionId))
      .limit(1);

    if (!session.length) {
      return c.json<ErrorResponse>(
        { success: false, error: "Academic session not found" },
        HttpStatus.BadRequest,
      );
    }

    const result = await createSubject(body);
    if (!result.ok) {
      return c.json<ErrorResponse>(
        { success: false, error: result.error },
        result.status as any,
      );
    }

    return c.json<SuccessResponse>(
      {
        success: true,
        message: "Subject created successfully",
        data: result.subject,
      },
      HttpStatus.Created,
    );
  },
);

examRouter.delete(
  "/subjects/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const subjectId = c.req.param("id");
    try {
      const existing = await db
        .select({ id: subjectsTable.id })
        .from(subjectsTable)
        .where(eq(subjectsTable.id, subjectId))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Subject not found" },
          HttpStatus.NotFound,
        );
      }

      await db.delete(subjectsTable).where(eq(subjectsTable.id, subjectId));
      return c.json<SuccessResponse>({
        success: true,
        message: "Subject deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting subject:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete subject" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.delete(
  "/subject/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const subjectId = c.req.param("id");
    try {
      const existing = await db
        .select({ id: subjectsTable.id })
        .from(subjectsTable)
        .where(eq(subjectsTable.id, subjectId))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Subject not found" },
          HttpStatus.NotFound,
        );
      }

      await db.delete(subjectsTable).where(eq(subjectsTable.id, subjectId));
      return c.json<SuccessResponse>({
        success: true,
        message: "Subject deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting subject:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete subject" },
        HttpStatus.InternalServerError,
      );
    }
  },
);
examRouter.post(
  "/class-subjects/assign",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateAssignClassSubject,
  async (c) => {
    const body = c.req.valid("json");
    try {
      const [session, klass, subject, teacher] = await Promise.all([
        db
          .select({ id: academicSessionsTable.id })
          .from(academicSessionsTable)
          .where(eq(academicSessionsTable.id, body.sessionId))
          .limit(1),
        db
          .select({ id: classesTable.id })
          .from(classesTable)
          .where(eq(classesTable.id, body.classId))
          .limit(1),
        db
          .select({ id: subjectsTable.id, sessionId: subjectsTable.sessionId })
          .from(subjectsTable)
          .where(eq(subjectsTable.id, body.subjectId))
          .limit(1),
        body.teacherId
          ? db
              .select({ id: teachersTable.id })
              .from(teachersTable)
              .where(eq(teachersTable.id, body.teacherId))
              .limit(1)
          : Promise.resolve([] as Array<{ id: string }>),
      ]);

      if (!session.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Academic session not found" },
          HttpStatus.BadRequest,
        );
      }
      if (!klass.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Class not found" },
          HttpStatus.BadRequest,
        );
      }
      if (!subject.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Subject not found" },
          HttpStatus.BadRequest,
        );
      }
      if (subject[0].sessionId !== body.sessionId) {
        return c.json<ErrorResponse>(
          { success: false, error: "Subject must belong to the same session" },
          HttpStatus.BadRequest,
        );
      }
      if (body.teacherId && !teacher.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Teacher not found" },
          HttpStatus.BadRequest,
        );
      }

      const existing = await db
        .select({ id: classSubjectsTable.id })
        .from(classSubjectsTable)
        .where(
          and(
            eq(classSubjectsTable.sessionId, body.sessionId),
            eq(classSubjectsTable.classId, body.classId),
            eq(classSubjectsTable.subjectId, body.subjectId),
          ),
        )
        .limit(1);

      if (existing.length) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error: "Subject already assigned to this class in this session",
          },
          HttpStatus.Conflict,
        );
      }

      const [created] = await db
        .insert(classSubjectsTable)
        .values(body)
        .returning();

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Class subject assigned successfully",
          data: created,
        },
        HttpStatus.Created,
      );
    } catch (err) {
      console.error("Error assigning class subject:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to assign class subject" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.get(
  "/class-subjects/all",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const sessionId = c.req.query("sessionId");
    const classId = c.req.query("classId");

    try {
      const rows = await db
        .select({
          id: classSubjectsTable.id,
          sessionId: classSubjectsTable.sessionId,
          classId: classSubjectsTable.classId,
          className: classesTable.name,
          subjectId: classSubjectsTable.subjectId,
          subjectName: subjectsTable.name,
          subjectCode: subjectsTable.code,
          subjectType: subjectsTable.subjectType,
          teacherId: classSubjectsTable.teacherId,
          teacherName: usersTable.fullName,
        })
        .from(classSubjectsTable)
        .innerJoin(classesTable, eq(classSubjectsTable.classId, classesTable.id))
        .innerJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
        .leftJoin(teachersTable, eq(classSubjectsTable.teacherId, teachersTable.id))
        .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
        .where(
          and(
            sessionId ? eq(classSubjectsTable.sessionId, sessionId) : undefined,
            classId ? eq(classSubjectsTable.classId, classId) : undefined,
          ),
        );

      return c.json<SuccessResponse>({
        success: true,
        message: "Class subjects retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error retrieving class subjects:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve class subjects" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.put(
  "/class-subjects/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateUpdateClassSubject,
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");

    try {
      const existing = await db
        .select({
          id: classSubjectsTable.id,
          sessionId: classSubjectsTable.sessionId,
          classId: classSubjectsTable.classId,
          subjectId: classSubjectsTable.subjectId,
          teacherId: classSubjectsTable.teacherId,
        })
        .from(classSubjectsTable)
        .where(eq(classSubjectsTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Class subject mapping not found" },
          HttpStatus.NotFound,
        );
      }

      const nextSubjectId = body.subjectId ?? existing[0].subjectId;
      const nextTeacherId =
        body.teacherId === undefined ? existing[0].teacherId : body.teacherId;

      const [subject, teacher] = await Promise.all([
        db
          .select({ id: subjectsTable.id, sessionId: subjectsTable.sessionId })
          .from(subjectsTable)
          .where(eq(subjectsTable.id, nextSubjectId))
          .limit(1),
        nextTeacherId
          ? db
              .select({ id: teachersTable.id })
              .from(teachersTable)
              .where(eq(teachersTable.id, nextTeacherId))
              .limit(1)
          : Promise.resolve([] as Array<{ id: string }>),
      ]);

      if (!subject.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Subject not found" },
          HttpStatus.BadRequest,
        );
      }
      if (subject[0].sessionId !== existing[0].sessionId) {
        return c.json<ErrorResponse>(
          { success: false, error: "Subject must belong to the same session" },
          HttpStatus.BadRequest,
        );
      }
      if (nextTeacherId && !teacher.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Teacher not found" },
          HttpStatus.BadRequest,
        );
      }

      const duplicate = await db
        .select({ id: classSubjectsTable.id })
        .from(classSubjectsTable)
        .where(
          and(
            eq(classSubjectsTable.sessionId, existing[0].sessionId),
            eq(classSubjectsTable.classId, existing[0].classId),
            eq(classSubjectsTable.subjectId, nextSubjectId),
            ne(classSubjectsTable.id, id),
          ),
        )
        .limit(1);

      if (duplicate.length) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error: "Subject already assigned to this class in this session",
          },
          HttpStatus.Conflict,
        );
      }

      const [updated] = await db
        .update(classSubjectsTable)
        .set({
          subjectId: nextSubjectId,
          teacherId: nextTeacherId,
        })
        .where(eq(classSubjectsTable.id, id))
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: "Class subject mapping updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating class subject mapping:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update class subject mapping" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.delete(
  "/class-subjects/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");
    try {
      const existing = await db
        .select({ id: classSubjectsTable.id })
        .from(classSubjectsTable)
        .where(eq(classSubjectsTable.id, id))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Class subject mapping not found" },
          HttpStatus.NotFound,
        );
      }

      await db.delete(classSubjectsTable).where(eq(classSubjectsTable.id, id));
      return c.json<SuccessResponse>({
        success: true,
        message: "Class subject removed successfully",
      });
    } catch (err) {
      console.error("Error deleting class subject mapping:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete class subject mapping" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.post(
  "/create",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateCreateExam,
  async (c) => {
    const body = c.req.valid("json");
    const user = (c as any).get("user") as { id: string };

    try {
      const created = await db.transaction(async (tx) => {
        const examGroupId = crypto.randomUUID();
        const [session, klass] = await Promise.all([
          tx
            .select({ id: academicSessionsTable.id, name: academicSessionsTable.name })
            .from(academicSessionsTable)
            .where(eq(academicSessionsTable.id, body.sessionId))
            .limit(1),
          tx
            .select({ id: classesTable.id })
            .from(classesTable)
            .where(eq(classesTable.id, body.classId))
            .limit(1),
        ]);

        if (!session.length) {
          throw { type: "bad_request", message: "Academic session not found" };
        }
        if (!klass.length) {
          throw { type: "bad_request", message: "Class not found" };
        }

        const existingExamOfType = await tx
          .select({
            id: examsTable.id,
          })
          .from(examsTable)
          .where(
            and(
              eq(examsTable.sessionId, body.sessionId),
              eq(examsTable.examType, body.examType),
            ),
          )
          .limit(1);

        if (existingExamOfType.length) {
          throw {
            type: "conflict",
            message:
              "This exam type is already created in this academic session",
          };
        }

        const [exam] = await tx
          .insert(examsTable)
          .values({
            sessionId: body.sessionId,
            examGroupId,
            classId: body.classId,
            name: EXAM_TYPE_LABELS[body.examType],
            examType: body.examType,
            description: body.description,
            academicYear: body.academicYear ?? session[0].name,
            startDate: toDateOrUndefined(body.startDate),
            endDate: toDateOrUndefined(body.endDate),
            status: body.status ?? "draft",
            createdBy: user.id,
          })
          .returning();
        await createExamSubjectsAndComponents(tx, {
          examId: exam.id,
          sessionId: body.sessionId,
          classId: body.classId,
          examType: body.examType,
        });

        return exam;
      });

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Exam created successfully",
          data: created,
        },
        HttpStatus.Created,
      );
    } catch (err: any) {
      if (err?.type === "bad_request") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.BadRequest,
        );
      }
      if (err?.type === "conflict") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.Conflict,
        );
      }
      if (isUniqueViolationError(err)) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error:
              "This exam type is already created in this academic session",
          },
          HttpStatus.Conflict,
        );
      }
      console.error("Error creating exam:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create exam" },
        HttpStatus.InternalServerError,
      );
    }
  },
);
examRouter.put(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateUpdateExam,
  async (c) => {
    const examId = c.req.param("id");
    const body = c.req.valid("json");

    try {
      const updated = await db.transaction(async (tx) => {
        const existing = await tx
          .select({
            id: examsTable.id,
            sessionId: examsTable.sessionId,
            classId: examsTable.classId,
            examType: examsTable.examType,
          })
          .from(examsTable)
          .where(eq(examsTable.id, examId))
          .limit(1);

        if (!existing.length) {
          throw { type: "not_found", message: "Exam not found" };
        }

        const nextSessionId = body.sessionId ?? existing[0].sessionId;
        const nextClassId = body.classId ?? existing[0].classId;

        const [session, klass] = await Promise.all([
          tx
            .select({ id: academicSessionsTable.id })
            .from(academicSessionsTable)
            .where(eq(academicSessionsTable.id, nextSessionId))
            .limit(1),
          tx
            .select({ id: classesTable.id })
            .from(classesTable)
            .where(eq(classesTable.id, nextClassId))
            .limit(1),
        ]);

        if (!session.length) {
          throw { type: "bad_request", message: "Academic session not found" };
        }
        if (!klass.length) {
          throw { type: "bad_request", message: "Class not found" };
        }
        if (body.examType && body.examType !== existing[0].examType) {
          throw {
            type: "bad_request",
            message: "Exam type cannot be changed after creation",
          };
        }
        if (body.sessionId && body.sessionId !== existing[0].sessionId) {
          throw {
            type: "bad_request",
            message:
              "Academic session cannot be changed after creation for a fixed-structure exam",
          };
        }
        if (body.classId && body.classId !== existing[0].classId) {
          throw {
            type: "bad_request",
            message:
              "Class cannot be changed after creation for a fixed-structure exam",
          };
        }

        const [exam] = await tx
          .update(examsTable)
          .set({
            sessionId: body.sessionId,
            classId: body.classId,
            name: EXAM_TYPE_LABELS[existing[0].examType],
            description: body.description,
            academicYear: body.academicYear,
            startDate: toDateOrUndefined(body.startDate),
            endDate: toDateOrUndefined(body.endDate),
            status: body.status,
            examType: body.examType,
          })
          .where(eq(examsTable.id, examId))
          .returning();

        return exam;
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Exam updated successfully",
        data: updated,
      });
    } catch (err: any) {
      if (err?.type === "not_found") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.NotFound,
        );
      }
      if (err?.type === "bad_request") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.BadRequest,
        );
      }
      console.error("Error updating exam:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update exam" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.put(
  "/:id/component-marks",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateUpdateExamComponentMarks,
  async (c) => {
    const examId = c.req.param("id");
    const { entries } = c.req.valid("json");

    try {
      await db.transaction(async (tx) => {
        const exam = await tx
          .select({ id: examsTable.id })
          .from(examsTable)
          .where(eq(examsTable.id, examId))
          .limit(1);

        if (!exam.length) {
          throw { type: "not_found", message: "Exam not found" };
        }

        const examSubjectIds = Array.from(
          new Set(entries.map((entry) => entry.examSubjectId)),
        );
        const examSubjects = await tx
          .select({ id: examSubjectsTable.id })
          .from(examSubjectsTable)
          .where(
            and(
              eq(examSubjectsTable.examId, examId),
              inArray(examSubjectsTable.id, examSubjectIds),
            ),
          );

        if (examSubjects.length !== examSubjectIds.length) {
          throw {
            type: "bad_request",
            message: "One or more exam subjects do not belong to this exam",
          };
        }

        for (const entry of entries) {
          const updated = await tx
            .update(examSubjectComponentsTable)
            .set({
              maxMarks: entry.maxMarks,
              passMarks: entry.passMarks,
            })
            .where(
              and(
                eq(
                  examSubjectComponentsTable.examSubjectId,
                  entry.examSubjectId,
                ),
                eq(examSubjectComponentsTable.component, entry.component),
              ),
            )
            .returning({ id: examSubjectComponentsTable.id });

          if (!updated.length) {
            throw {
              type: "bad_request",
              message:
                "One or more subject components do not exist for this exam",
            };
          }
        }

        const allComponents = await tx
          .select({
            examSubjectId: examSubjectComponentsTable.examSubjectId,
            maxMarks: examSubjectComponentsTable.maxMarks,
            passMarks: examSubjectComponentsTable.passMarks,
          })
          .from(examSubjectComponentsTable)
          .where(
            inArray(examSubjectComponentsTable.examSubjectId, examSubjectIds),
          );

        const totalsByExamSubjectId = new Map<
          string,
          { maxMarks: number; passMarks: number }
        >();
        for (const item of allComponents) {
          const existing = totalsByExamSubjectId.get(item.examSubjectId) ?? {
            maxMarks: 0,
            passMarks: 0,
          };
          existing.maxMarks += item.maxMarks;
          existing.passMarks += item.passMarks;
          totalsByExamSubjectId.set(item.examSubjectId, existing);
        }

        for (const [examSubjectId, totals] of totalsByExamSubjectId) {
          await tx
            .update(examSubjectsTable)
            .set({
              maxMarks: totals.maxMarks,
              passMarks: totals.passMarks,
            })
            .where(eq(examSubjectsTable.id, examSubjectId));
        }
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Exam component marks updated successfully",
      });
    } catch (err: any) {
      if (err?.type === "not_found") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.NotFound,
        );
      }
      if (err?.type === "bad_request") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.BadRequest,
        );
      }
      console.error("Error updating exam component marks:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update exam component marks" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.delete(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const examId = c.req.param("id");
    try {
      const existing = await db
        .select({ id: examsTable.id })
        .from(examsTable)
        .where(eq(examsTable.id, examId))
        .limit(1);

      if (!existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found" },
          HttpStatus.NotFound,
        );
      }

      await db.delete(examsTable).where(eq(examsTable.id, examId));
      return c.json<SuccessResponse>({
        success: true,
        message: "Exam deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting exam:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete exam" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.post(
  "/:id/subjects",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    return c.json<ErrorResponse>(
      {
        success: false,
        error:
          "Manual subject assignment is disabled. Subjects are auto-linked from class-subject mappings during exam creation.",
      },
      HttpStatus.BadRequest,
    );
  },
);

examRouter.post(
  "/:id/enroll-students",
  requireAuth,
  requireRoles([Role.ADMIN]),
  validateEnrollStudents,
  async (c) => {
    const examId = c.req.param("id");
    const { studentIds } = c.req.valid("json");

    try {
      const enrollments = await db.transaction(async (tx) => {
        const exam = await tx
          .select({
            id: examsTable.id,
            classId: examsTable.classId,
            sessionId: examsTable.sessionId,
          })
          .from(examsTable)
          .where(eq(examsTable.id, examId))
          .limit(1);

        if (!exam.length) {
          throw { type: "not_found", message: "Exam not found" };
        }

        const students = await tx
          .select({
            id: studentsTable.id,
            classId: studentsTable.classId,
            sessionId: studentsTable.sessionId,
          })
          .from(studentsTable)
          .where(inArray(studentsTable.id, studentIds));

        if (students.length !== new Set(studentIds).size) {
          throw { type: "bad_request", message: "One or more students do not exist" };
        }

        const invalid = students.some(
          (student) =>
            student.classId !== exam[0].classId ||
            student.sessionId !== exam[0].sessionId,
        );
        if (invalid) {
          throw {
            type: "bad_request",
            message:
              "Only students from the same exam class and academic session can be enrolled",
          };
        }

        return tx
          .insert(studentExamEnrollmentsTable)
          .values(studentIds.map((studentId) => ({ examId, studentId })))
          .onConflictDoNothing()
          .returning();
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Students enrolled successfully",
        data: enrollments,
      });
    } catch (err: any) {
      if (err?.type === "not_found") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.NotFound,
        );
      }
      if (err?.type === "bad_request") {
        return c.json<ErrorResponse>(
          { success: false, error: err.message },
          HttpStatus.BadRequest,
        );
      }
      console.error("Error enrolling students:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to enroll students" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.get(
  "/all",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const sessionId = c.req.query("sessionId");
    try {
      const rows = await db
        .select({
          id: examsTable.id,
          sessionId: examsTable.sessionId,
          examGroupId: examsTable.examGroupId,
          classId: examsTable.classId,
          name: examsTable.name,
          examType: examsTable.examType,
          description: examsTable.description,
          academicYear: examsTable.academicYear,
          startDate: examsTable.startDate,
          endDate: examsTable.endDate,
          status: examsTable.status,
          createdAt: examsTable.createdAt,
          updatedAt: examsTable.updatedAt,
          creatorId: usersTable.id,
          creatorName: usersTable.fullName,
          className: classesTable.name,
          marksEntryMode: examMarksControlsTable.mode,
        })
        .from(examsTable)
        .innerJoin(usersTable, eq(examsTable.createdBy, usersTable.id))
        .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
        .leftJoin(examMarksControlsTable, eq(examMarksControlsTable.examId, examsTable.id))
        .where(sessionId ? eq(examsTable.sessionId, sessionId) : undefined);

      return c.json<SuccessResponse>({
        success: true,
        message: "Exams retrieved successfully",
        data: rows.map((row) => ({
          ...row,
          marksEntryMode: row.marksEntryMode ?? "closed",
        })),
      });
    } catch (err) {
      console.error("Error retrieving exams:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve exams" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.get(
  "/marks-control/:examId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("param", examIdParamSchema),
  async (c) => {
    const { examId } = c.req.valid("param");

    try {
      const rows = await db
        .select({
          examId: examsTable.id,
          examName: examsTable.name,
          examType: examsTable.examType,
          academicYear: examsTable.academicYear,
          classId: examsTable.classId,
          className: classesTable.name,
          sessionId: examsTable.sessionId,
          sessionName: academicSessionsTable.name,
          mode: examMarksControlsTable.mode,
          updatedAt: examMarksControlsTable.updatedAt,
          updatedBy: examMarksControlsTable.updatedBy,
          updatedByName: usersTable.fullName,
        })
        .from(examsTable)
        .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
        .innerJoin(
          academicSessionsTable,
          eq(examsTable.sessionId, academicSessionsTable.id),
        )
        .leftJoin(examMarksControlsTable, eq(examMarksControlsTable.examId, examsTable.id))
        .leftJoin(usersTable, eq(examMarksControlsTable.updatedBy, usersTable.id))
        .where(eq(examsTable.id, examId))
        .limit(1);

      if (!rows.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found" },
          HttpStatus.NotFound,
        );
      }

      const row = rows[0];
      return c.json<SuccessResponse>({
        success: true,
        message: "Marks control retrieved successfully",
        data: {
          exam: {
            id: row.examId,
            name: row.examName,
            examType: row.examType,
            academicYear: row.academicYear,
            classId: row.classId,
            className: row.className,
            sessionId: row.sessionId,
            sessionName: row.sessionName,
          },
          control: {
            mode: row.mode ?? "closed",
            updatedAt: row.updatedAt ?? null,
            updatedBy: row.updatedBy ?? null,
            updatedByName: row.updatedByName ?? null,
          },
        },
      });
    } catch (err) {
      console.error("Error retrieving marks control:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve marks control" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.put(
  "/marks-control/:examId",
  requireAuth,
  requireRoles([Role.ADMIN]),
  zValidator("param", examIdParamSchema),
  zValidator("json", marksControlUpdateSchema),
  async (c) => {
    const { examId } = c.req.valid("param");
    const { mode } = c.req.valid("json");
    const user = (c as any).get("user") as { id: string };

    try {
      const examExists = await db
        .select({ id: examsTable.id })
        .from(examsTable)
        .where(eq(examsTable.id, examId))
        .limit(1);

      if (!examExists.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found" },
          HttpStatus.NotFound,
        );
      }

      await db
        .insert(examMarksControlsTable)
        .values({
          examId,
          mode,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .onConflictDoUpdate({
          target: examMarksControlsTable.examId,
          set: {
            mode,
            updatedBy: user.id,
            updatedAt: new Date(),
          },
        });

      return c.json<SuccessResponse>({
        success: true,
        message: "Marks control updated successfully",
      });
    } catch (err) {
      console.error("Error updating marks control:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update marks control" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.post(
  "/marks",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  validateEnterMarks,
  async (c) => {
    const { entries, examId } = c.req.valid("json");
    const user = (c as any).get("user") as { id: string };
    const userRoles = ((c as any).get("userRole") as string[] | undefined) ?? [];
    const isAdmin = userRoles.includes(Role.ADMIN);

    try {
      if (!isAdmin && examId) {
        const accessError = await ensureTeacherMarksEntryAccess(userRoles, examId);
        if (accessError) {
          return c.json<ErrorResponse>(accessError, HttpStatus.Forbidden);
        }
      }

      const normalizedEntries = entries.map((entry) => ({ ...entry }));

      if (examId) {
        const examSubjectRows = await db
          .select({
            examSubjectId: examSubjectsTable.id,
            subjectId: examSubjectsTable.subjectId,
          })
          .from(examSubjectsTable)
          .where(eq(examSubjectsTable.examId, examId));

        const examSubjectBySubjectId = new Map(
          examSubjectRows.map((row) => [row.subjectId, row.examSubjectId]),
        );

        for (const entry of normalizedEntries) {
          if (entry.subjectId) {
            const resolved = examSubjectBySubjectId.get(entry.subjectId);
            if (resolved) {
              entry.examSubjectId = resolved;
            }
          }
        }
      }

      const duplicateReqKeys = new Set<string>();
      for (const entry of normalizedEntries) {
        const key = `${entry.studentId}:${entry.examSubjectId}:${entry.component}`;
        if (duplicateReqKeys.has(key)) {
          return c.json<ErrorResponse>(
            { success: false, error: "Duplicate mark entry in request" },
            HttpStatus.BadRequest,
          );
        }
        duplicateReqKeys.add(key);
      }

      const teacherProfileId = await getTeacherProfileId(user.id);
      const examSubjectIds = Array.from(
        new Set(normalizedEntries.map((item) => item.examSubjectId)),
      );
      const studentIds = Array.from(
        new Set(normalizedEntries.map((item) => item.studentId)),
      );

      const [examSubjects, examSubjectComponents, students, existingMarks] =
        await Promise.all([
        db
          .select({
            examSubjectId: examSubjectsTable.id,
            examId: examSubjectsTable.examId,
            subjectId: examSubjectsTable.subjectId,
            maxMarks: examSubjectsTable.maxMarks,
            classId: examsTable.classId,
            sessionId: examsTable.sessionId,
          })
          .from(examSubjectsTable)
          .innerJoin(examsTable, eq(examSubjectsTable.examId, examsTable.id))
          .where(inArray(examSubjectsTable.id, examSubjectIds)),
        db
          .select({
            examSubjectId: examSubjectComponentsTable.examSubjectId,
            component: examSubjectComponentsTable.component,
            maxMarks: examSubjectComponentsTable.maxMarks,
          })
          .from(examSubjectComponentsTable)
          .where(inArray(examSubjectComponentsTable.examSubjectId, examSubjectIds)),
        db
          .select({
            id: studentsTable.id,
            classId: studentsTable.classId,
            sessionId: studentsTable.sessionId,
          })
          .from(studentsTable)
          .where(inArray(studentsTable.id, studentIds)),
        db
          .select({
            studentId: studentMarksTable.studentId,
            examSubjectId: studentMarksTable.examSubjectId,
            component: studentMarksTable.component,
          })
          .from(studentMarksTable)
          .where(
            and(
              inArray(studentMarksTable.studentId, studentIds),
              inArray(studentMarksTable.examSubjectId, examSubjectIds),
            ),
          ),
        ]);

      const examSubjectMap = new Map(
        examSubjects.map((row) => [row.examSubjectId, row]),
      );
      const componentConfigMap = new Map<
        string,
        { examSubjectId: string; component: string; maxMarks: number }
      >(
        examSubjectComponents.map((row) => [
          `${row.examSubjectId}:${row.component}`,
          row,
        ]),
      );
      const studentMap = new Map(students.map((row) => [row.id, row]));
      const existingKeys = new Set(
        existingMarks.map(
          (row) => `${row.studentId}:${row.examSubjectId}:${row.component}`,
        ),
      );

      const examIds = Array.from(new Set(examSubjects.map((row) => row.examId)));
      if (!isAdmin) {
        for (const itemExamId of examIds) {
          const accessError = await ensureTeacherMarksEntryAccess(userRoles, itemExamId);
          if (accessError) {
            return c.json<ErrorResponse>(accessError, HttpStatus.Forbidden);
          }
        }
      }

      const enrollmentRows = await db
        .select({
          examId: studentExamEnrollmentsTable.examId,
          studentId: studentExamEnrollmentsTable.studentId,
        })
        .from(studentExamEnrollmentsTable)
        .where(
          and(
            inArray(studentExamEnrollmentsTable.examId, examIds),
            inArray(studentExamEnrollmentsTable.studentId, studentIds),
          ),
        );
      const enrollmentKeys = new Set(
        enrollmentRows.map((row) => `${row.examId}:${row.studentId}`),
      );

      const classSubjectRows = await db
        .select({
          sessionId: classSubjectsTable.sessionId,
          classId: classSubjectsTable.classId,
          subjectId: classSubjectsTable.subjectId,
          teacherId: classSubjectsTable.teacherId,
        })
        .from(classSubjectsTable)
        .where(
          and(
            inArray(
              classSubjectsTable.sessionId,
              Array.from(new Set(examSubjects.map((row) => row.sessionId))),
            ),
            inArray(
              classSubjectsTable.classId,
              Array.from(new Set(examSubjects.map((row) => row.classId))),
            ),
            inArray(
              classSubjectsTable.subjectId,
              Array.from(new Set(examSubjects.map((row) => row.subjectId))),
            ),
          ),
        );
      const classSubjectTeacherMap = new Map(
        classSubjectRows.map((row) => [
          `${row.sessionId}:${row.classId}:${row.subjectId}`,
          row.teacherId,
        ]),
      );

      const validEntries: typeof normalizedEntries = [];

      for (const entry of normalizedEntries) {
        const examSubject = examSubjectMap.get(entry.examSubjectId);
        if (!examSubject) {
          continue;
        }
        const student = studentMap.get(entry.studentId);
        if (!student) {
          return c.json<ErrorResponse>(
            { success: false, error: "One or more students do not exist" },
            HttpStatus.BadRequest,
          );
        }
        if (
          student.classId !== examSubject.classId ||
          student.sessionId !== examSubject.sessionId
        ) {
          return c.json<ErrorResponse>(
            {
              success: false,
              error: "Student does not belong to the same exam class/session",
            },
            HttpStatus.BadRequest,
          );
        }
        if (!enrollmentKeys.has(`${examSubject.examId}:${entry.studentId}`)) {
          return c.json<ErrorResponse>(
            { success: false, error: "One or more students are not enrolled in this exam" },
            HttpStatus.BadRequest,
          );
        }
        const componentCfg = componentConfigMap.get(
          `${entry.examSubjectId}:${entry.component}`,
        );
        if (!componentCfg) {
          return c.json<ErrorResponse>(
            {
              success: false,
              error: "Invalid component for one or more exam subjects",
            },
            HttpStatus.BadRequest,
          );
        }
        if (entry.obtainedMarks > componentCfg.maxMarks) {
          return c.json<ErrorResponse>(
            { success: false, error: "Obtained marks cannot exceed max marks" },
            HttpStatus.BadRequest,
          );
        }
        if (
          existingKeys.has(
            `${entry.studentId}:${entry.examSubjectId}:${entry.component}`,
          )
        ) {
          return c.json<ErrorResponse>(
            { success: false, error: "Duplicate mark entry not allowed" },
            HttpStatus.Conflict,
          );
        }

        const assignedTeacher = classSubjectTeacherMap.get(
          `${examSubject.sessionId}:${examSubject.classId}:${examSubject.subjectId}`,
        );
        if (!isAdmin) {
          if (!assignedTeacher) {
            return c.json<ErrorResponse>(
              {
                success: false,
                error:
                  "Marks can be entered only for subjects assigned to a teacher",
              },
              HttpStatus.Forbidden,
            );
          }
          if (assignedTeacher !== teacherProfileId) {
            return c.json<ErrorResponse>(
              { success: false, error: "Only assigned teacher can enter marks" },
              HttpStatus.Forbidden,
            );
          }
        }

        validEntries.push(entry);
      }

      if (!validEntries.length) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error:
              "No valid mark entries found for this exam. Please reload exam data and try again.",
          },
          HttpStatus.BadRequest,
        );
      }

      const inserted = await db
        .insert(studentMarksTable)
        .values(
          validEntries.map((entry) => ({
            studentId: entry.studentId,
            examSubjectId: entry.examSubjectId,
            component: entry.component,
            obtainedMarks: entry.obtainedMarks,
            gradedBy: user.id,
          })),
        )
        .returning();

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Marks saved successfully",
          data: inserted,
        },
        HttpStatus.Created,
      );
    } catch (err) {
      console.error("Error saving marks:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to save marks" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.put(
  "/marks/bulk-update",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  validateBulkUpdateMarks,
  async (c) => {
    const { entries } = c.req.valid("json");
    const user = (c as any).get("user") as { id: string };
    const userRoles = ((c as any).get("userRole") as string[] | undefined) ?? [];
    const isAdmin = userRoles.includes(Role.ADMIN);

    try {
      if (!isAdmin) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error:
              "Teachers cannot edit marks after saving. Please contact admin.",
          },
          HttpStatus.Forbidden,
        );
      }

      const markIds = entries.map((entry) => entry.markId);
      const uniqueMarkIds = Array.from(new Set(markIds));
      if (uniqueMarkIds.length !== markIds.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Duplicate mark update entries are not allowed" },
          HttpStatus.BadRequest,
        );
      }

      const rows = await db
        .select({
          id: studentMarksTable.id,
          maxMarks: examSubjectComponentsTable.maxMarks,
        })
        .from(studentMarksTable)
        .innerJoin(
          examSubjectComponentsTable,
          and(
            eq(
              examSubjectComponentsTable.examSubjectId,
              studentMarksTable.examSubjectId,
            ),
            eq(examSubjectComponentsTable.component, studentMarksTable.component),
          ),
        )
        .where(inArray(studentMarksTable.id, uniqueMarkIds));

      if (rows.length !== uniqueMarkIds.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "One or more marks were not found" },
          HttpStatus.NotFound,
        );
      }

      const maxMarksById = new Map(rows.map((row) => [row.id, row.maxMarks]));
      for (const entry of entries) {
        const maxMarks = maxMarksById.get(entry.markId);
        if (maxMarks === undefined) {
          return c.json<ErrorResponse>(
            { success: false, error: "One or more marks were not found" },
            HttpStatus.NotFound,
          );
        }
        if (entry.obtainedMarks > maxMarks) {
          return c.json<ErrorResponse>(
            { success: false, error: "Obtained marks cannot exceed max marks" },
            HttpStatus.BadRequest,
          );
        }
      }

      const updated = await db.transaction(async (tx) => {
        const updatedRows: Array<typeof studentMarksTable.$inferSelect> = [];
        for (const entry of entries) {
          const [row] = await tx
            .update(studentMarksTable)
            .set({
              obtainedMarks: entry.obtainedMarks,
              gradedBy: user.id,
              updatedAt: new Date(),
            })
            .where(eq(studentMarksTable.id, entry.markId))
            .returning();
          if (!row) {
            throw new Error("Failed to update one or more marks");
          }
          updatedRows.push(row);
        }
        return updatedRows;
      });

      return c.json<SuccessResponse>({
        success: true,
        message: "Marks updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating marks in bulk:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update marks" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.put(
  "/marks/:markId",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  validateUpdateMark,
  async (c) => {
    const markId = c.req.param("markId");
    const { obtainedMarks } = c.req.valid("json");
    const user = (c as any).get("user") as { id: string };
    const userRoles = ((c as any).get("userRole") as string[] | undefined) ?? [];
    const isAdmin = userRoles.includes(Role.ADMIN);

    try {
      if (!isAdmin) {
        return c.json<ErrorResponse>(
          {
            success: false,
            error:
              "Teachers cannot edit marks after saving. Please contact admin.",
          },
          HttpStatus.Forbidden,
        );
      }

      const teacherProfileId = await getTeacherProfileId(user.id);

      const row = await db
        .select({
          id: studentMarksTable.id,
          maxMarks: examSubjectComponentsTable.maxMarks,
          sessionId: examsTable.sessionId,
          classId: examsTable.classId,
          subjectId: examSubjectsTable.subjectId,
          component: studentMarksTable.component,
        })
        .from(studentMarksTable)
        .innerJoin(
          examSubjectComponentsTable,
          and(
            eq(
              examSubjectComponentsTable.examSubjectId,
              studentMarksTable.examSubjectId,
            ),
            eq(examSubjectComponentsTable.component, studentMarksTable.component),
          ),
        )
        .innerJoin(
          examSubjectsTable,
          eq(studentMarksTable.examSubjectId, examSubjectsTable.id),
        )
        .innerJoin(examsTable, eq(examSubjectsTable.examId, examsTable.id))
        .where(eq(studentMarksTable.id, markId))
        .limit(1);

      if (!row.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Mark not found" },
          HttpStatus.NotFound,
        );
      }

      if (obtainedMarks > row[0].maxMarks) {
        return c.json<ErrorResponse>(
          { success: false, error: "Obtained marks cannot exceed max marks" },
          HttpStatus.BadRequest,
        );
      }

      const classSubject = await db
        .select({ teacherId: classSubjectsTable.teacherId })
        .from(classSubjectsTable)
        .where(
          and(
            eq(classSubjectsTable.sessionId, row[0].sessionId),
            eq(classSubjectsTable.classId, row[0].classId),
            eq(classSubjectsTable.subjectId, row[0].subjectId),
          ),
        )
        .limit(1);

      if (!isAdmin) {
        if (!classSubject[0]?.teacherId) {
          return c.json<ErrorResponse>(
            {
              success: false,
              error: "Marks can be updated only for subjects assigned to a teacher",
            },
            HttpStatus.Forbidden,
          );
        }
        if (classSubject[0].teacherId !== teacherProfileId) {
          return c.json<ErrorResponse>(
            { success: false, error: "Only assigned teacher can update marks" },
            HttpStatus.Forbidden,
          );
        }
      }

      const [updated] = await db
        .update(studentMarksTable)
        .set({
          obtainedMarks,
          gradedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(studentMarksTable.id, markId))
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: "Mark updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating mark:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update mark" },
        HttpStatus.InternalServerError,
      );
    }
  },
);
examRouter.get(
  "/:id/students",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const examId = c.req.param("id");
    const userRoles = ((c as any).get("userRole") as string[] | undefined) ?? [];
    try {
      const accessError = await ensureTeacherMarksEntryAccess(userRoles, examId);
      if (accessError) {
        return c.json<ErrorResponse>(accessError, HttpStatus.Forbidden);
      }

      const examExists = await db
        .select({ id: examsTable.id })
        .from(examsTable)
        .where(eq(examsTable.id, examId))
        .limit(1);

      if (!examExists.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found" },
          HttpStatus.NotFound,
        );
      }

      const rows = await db
        .select({
          enrollmentId: studentExamEnrollmentsTable.id,
          studentId: studentsTable.id,
          rollNumber: studentsTable.rollNumber,
          enrollmentNo: studentsTable.enrollmentNo,
          admissionNo: studentsTable.admissionNo,
          className: classesTable.name,
          userId: usersTable.id,
          fullName: usersTable.fullName,
          username: usersTable.username,
        })
        .from(studentExamEnrollmentsTable)
        .innerJoin(
          studentsTable,
          eq(studentExamEnrollmentsTable.studentId, studentsTable.id),
        )
        .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .where(eq(studentExamEnrollmentsTable.examId, examId));

      return c.json<SuccessResponse>({
        success: true,
        message: "Exam students retrieved successfully",
        data: rows,
      });
    } catch (err) {
      console.error("Error retrieving exam students:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve exam students" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.get(
  "/:id/marks",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const examId = c.req.param("id");
    const userRoles = ((c as any).get("userRole") as string[] | undefined) ?? [];
    try {
      const accessError = await ensureTeacherMarksEntryAccess(userRoles, examId);
      if (accessError) {
        return c.json<ErrorResponse>(accessError, HttpStatus.Forbidden);
      }

      const exam = await db
        .select({ id: examsTable.id })
        .from(examsTable)
        .where(eq(examsTable.id, examId))
        .limit(1);

      if (!exam.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found" },
          HttpStatus.NotFound,
        );
      }

      const rows = await db
        .select({
          id: studentMarksTable.id,
          examId: examsTable.id,
          studentId: studentMarksTable.studentId,
          examSubjectId: studentMarksTable.examSubjectId,
          component: studentMarksTable.component,
          subjectId: examSubjectsTable.subjectId,
          obtainedMarks: studentMarksTable.obtainedMarks,
          gradedBy: studentMarksTable.gradedBy,
          updatedAt: studentMarksTable.updatedAt,
          studentName: usersTable.fullName,
          rollNumber: studentsTable.rollNumber,
          subjectName: subjectsTable.name,
          subjectCode: subjectsTable.code,
          maxMarks: examSubjectsTable.maxMarks,
          passMarks: examSubjectsTable.passMarks,
        })
        .from(studentMarksTable)
        .innerJoin(
          examSubjectsTable,
          eq(studentMarksTable.examSubjectId, examSubjectsTable.id),
        )
        .innerJoin(examsTable, eq(examSubjectsTable.examId, examsTable.id))
        .innerJoin(studentsTable, eq(studentMarksTable.studentId, studentsTable.id))
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .innerJoin(subjectsTable, eq(examSubjectsTable.subjectId, subjectsTable.id))
        .where(eq(examsTable.id, examId));

      const enrichedRows = rows.map((row) => ({
        ...row,
        componentLabel:
          COMPONENT_LABELS[row.component as keyof typeof COMPONENT_LABELS] ??
          row.component,
      }));

      return c.json<SuccessResponse>({
        success: true,
        message: "Marks retrieved successfully",
        data: enrichedRows,
      });
    } catch (err) {
      console.error("Error retrieving marks:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve marks" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

examRouter.get(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN, Role.TEACHER]),
  async (c) => {
    const examId = c.req.param("id");
    const userRoles = ((c as any).get("userRole") as string[] | undefined) ?? [];

    try {
      const accessError = await ensureTeacherMarksEntryAccess(userRoles, examId);
      if (accessError) {
        return c.json<ErrorResponse>(accessError, HttpStatus.Forbidden);
      }

      const exam = await db
        .select({
          id: examsTable.id,
          sessionId: examsTable.sessionId,
          examGroupId: examsTable.examGroupId,
          classId: examsTable.classId,
          className: classesTable.name,
          name: examsTable.name,
          examType: examsTable.examType,
          description: examsTable.description,
          academicYear: examsTable.academicYear,
          startDate: examsTable.startDate,
          endDate: examsTable.endDate,
          status: examsTable.status,
          createdBy: examsTable.createdBy,
          createdByName: usersTable.fullName,
          createdAt: examsTable.createdAt,
          updatedAt: examsTable.updatedAt,
          marksEntryMode: examMarksControlsTable.mode,
        })
        .from(examsTable)
        .innerJoin(usersTable, eq(examsTable.createdBy, usersTable.id))
        .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
        .leftJoin(examMarksControlsTable, eq(examMarksControlsTable.examId, examsTable.id))
        .where(eq(examsTable.id, examId))
        .limit(1);

      if (!exam.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Exam not found" },
          HttpStatus.NotFound,
        );
      }

      const subjects = await db
        .select({
          examSubjectId: examSubjectsTable.id,
          subjectId: subjectsTable.id,
          subjectName: subjectsTable.name,
          subjectCode: subjectsTable.code,
          maxMarks: examSubjectsTable.maxMarks,
          passMarks: examSubjectsTable.passMarks,
          examDate: examSubjectsTable.examDate,
          startTime: examSubjectsTable.startTime,
          endTime: examSubjectsTable.endTime,
        })
        .from(examSubjectsTable)
        .innerJoin(subjectsTable, eq(examSubjectsTable.subjectId, subjectsTable.id))
        .where(eq(examSubjectsTable.examId, examId));

      const subjectComponents = await db
        .select({
          examSubjectId: examSubjectComponentsTable.examSubjectId,
          component: examSubjectComponentsTable.component,
          maxMarks: examSubjectComponentsTable.maxMarks,
          passMarks: examSubjectComponentsTable.passMarks,
        })
        .from(examSubjectComponentsTable)
        .innerJoin(
          examSubjectsTable,
          eq(examSubjectComponentsTable.examSubjectId, examSubjectsTable.id),
        )
        .where(eq(examSubjectsTable.examId, examId));

      const teacherAssignments = await db
        .select({
          subjectId: classSubjectsTable.subjectId,
          teacherId: classSubjectsTable.teacherId,
          teacherName: usersTable.fullName,
        })
        .from(classSubjectsTable)
        .leftJoin(teachersTable, eq(classSubjectsTable.teacherId, teachersTable.id))
        .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
        .where(
          and(
            eq(classSubjectsTable.sessionId, exam[0].sessionId),
            eq(classSubjectsTable.classId, exam[0].classId),
          ),
        );
      const teacherBySubjectId = new Map<
        string,
        { teacherId: string | null; teacherName: string | null }
      >(
        teacherAssignments.map((item) => [
          item.subjectId,
          {
            teacherId: item.teacherId,
            teacherName: item.teacherName ?? null,
          },
        ]),
      );

      const componentsByExamSubjectId = new Map<
        string,
        Array<{
          component: string;
          componentLabel: string;
          maxMarks: number;
          passMarks: number;
        }>
      >();
      for (const item of subjectComponents) {
        const key = item.examSubjectId;
        const bucket = componentsByExamSubjectId.get(key) ?? [];
        bucket.push({
          component: item.component,
          componentLabel:
            COMPONENT_LABELS[item.component as keyof typeof COMPONENT_LABELS] ??
            item.component,
          maxMarks: item.maxMarks,
          passMarks: item.passMarks,
        });
        componentsByExamSubjectId.set(key, bucket);
      }

      const enrollmentCount = await db
        .select({ id: studentExamEnrollmentsTable.id })
        .from(studentExamEnrollmentsTable)
        .where(eq(studentExamEnrollmentsTable.examId, examId));

      return c.json<SuccessResponse>({
        success: true,
        message: "Exam retrieved successfully",
        data: {
          ...exam[0],
          marksEntryMode: exam[0].marksEntryMode ?? "closed",
          subjects: subjects.map((subject) => ({
            ...subject,
            components: componentsByExamSubjectId.get(subject.examSubjectId) ?? [],
            assignedTeacherId:
              teacherBySubjectId.get(subject.subjectId)?.teacherId ?? null,
            assignedTeacherName:
              teacherBySubjectId.get(subject.subjectId)?.teacherName ?? null,
          })),
          enrolledStudentsCount: enrollmentCount.length,
          classNames: exam[0].className ? [exam[0].className] : [],
        },
      });
    } catch (err) {
      console.error("Error retrieving exam:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve exam" },
        HttpStatus.InternalServerError,
      );
    }
  },
);

export default examRouter;
