import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { classesTable } from "../db/schemas/classes";
import { studentUploadControlsTable } from "../db/schemas/studentUploadControls";
import { studentsTable } from "../db/schemas/students";

export type StudentUploadScope = "all" | "class";

export type ResolvedStudentUploadControl = {
  scopeType: StudentUploadScope;
  classId: string | null;
  className: string | null;
  documentUploadEnabled: boolean;
  profileUploadEnabled: boolean;
  requestedDocumentTypes: string[];
  updatedAt: Date | null;
};

let ensureStudentUploadControlSchemaPromise: Promise<void> | null = null;

const parseRequestedDocumentTypes = (value: string | null | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const serializeRequestedDocumentTypes = (values: string[]) =>
  values
    .map((item) => item.trim().toLowerCase().replace(/[^a-z0-9 -]+/g, ""))
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(",");

export const ensureStudentUploadControlSchema = async () => {
  if (!ensureStudentUploadControlSchemaPromise) {
    ensureStudentUploadControlSchemaPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS student_upload_controls (
          id uuid PRIMARY KEY,
          "scopeType" varchar(20) NOT NULL,
          "classId" uuid REFERENCES classes(id),
          "requestedDocumentTypes" text,
          "documentUploadEnabled" boolean NOT NULL DEFAULT false,
          "profileUploadEnabled" boolean NOT NULL DEFAULT false,
          "createdAt" timestamptz DEFAULT now(),
          "updatedAt" timestamptz
        )
      `);
    })().catch((err) => {
      ensureStudentUploadControlSchemaPromise = null;
      throw err;
    });
  }

  await ensureStudentUploadControlSchemaPromise;
};

export const getStudentUploadControlConfig = async () => {
  await ensureStudentUploadControlSchema();

  const [allControl] = await db
    .select()
    .from(studentUploadControlsTable)
    .where(eq(studentUploadControlsTable.scopeType, "all"))
    .orderBy(desc(studentUploadControlsTable.updatedAt), desc(studentUploadControlsTable.createdAt))
    .limit(1);

  const classControls = await db
    .select({
      id: studentUploadControlsTable.id,
      scopeType: studentUploadControlsTable.scopeType,
      classId: studentUploadControlsTable.classId,
      className: classesTable.name,
      requestedDocumentTypes: studentUploadControlsTable.requestedDocumentTypes,
      documentUploadEnabled: studentUploadControlsTable.documentUploadEnabled,
      profileUploadEnabled: studentUploadControlsTable.profileUploadEnabled,
      updatedAt: studentUploadControlsTable.updatedAt,
    })
    .from(studentUploadControlsTable)
    .leftJoin(classesTable, eq(studentUploadControlsTable.classId, classesTable.id))
    .where(eq(studentUploadControlsTable.scopeType, "class"))
    .orderBy(classesTable.name);

  return {
    all: {
      scopeType: "all" as const,
      classId: null,
      className: null,
      documentUploadEnabled: allControl?.documentUploadEnabled ?? false,
      profileUploadEnabled: allControl?.profileUploadEnabled ?? false,
      requestedDocumentTypes: parseRequestedDocumentTypes(allControl?.requestedDocumentTypes),
      updatedAt: allControl?.updatedAt ?? null,
    },
    classes: classControls.map((item) => ({
      scopeType: "class" as const,
      classId: item.classId ?? null,
      className: item.className ?? null,
      documentUploadEnabled: item.documentUploadEnabled ?? false,
      profileUploadEnabled: item.profileUploadEnabled ?? false,
      requestedDocumentTypes: parseRequestedDocumentTypes(item.requestedDocumentTypes),
      updatedAt: item.updatedAt ?? null,
    })),
  };
};

export const saveStudentUploadControl = async ({
  scopeType,
  classId,
  documentUploadEnabled,
  profileUploadEnabled,
  requestedDocumentTypes,
}: {
  scopeType: StudentUploadScope;
  classId?: string | null;
  documentUploadEnabled: boolean;
  profileUploadEnabled: boolean;
  requestedDocumentTypes: string[];
}) => {
  await ensureStudentUploadControlSchema();

  const lookup =
    scopeType === "all"
      ? await db
          .select({ id: studentUploadControlsTable.id })
          .from(studentUploadControlsTable)
          .where(eq(studentUploadControlsTable.scopeType, "all"))
          .limit(1)
      : await db
          .select({ id: studentUploadControlsTable.id })
          .from(studentUploadControlsTable)
          .where(
            and(
              eq(studentUploadControlsTable.scopeType, "class"),
              eq(studentUploadControlsTable.classId, classId ?? ""),
            ),
          )
          .limit(1);

  const values = {
    scopeType,
    classId: scopeType === "class" ? classId ?? null : null,
    requestedDocumentTypes: serializeRequestedDocumentTypes(requestedDocumentTypes),
    documentUploadEnabled,
    profileUploadEnabled,
    updatedAt: new Date(),
  };

  if (lookup[0]) {
    const [updated] = await db
      .update(studentUploadControlsTable)
      .set(values)
      .where(eq(studentUploadControlsTable.id, lookup[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(studentUploadControlsTable)
    .values({
      id: randomUUID(),
      ...values,
      createdAt: new Date(),
    })
    .returning();

  return created;
};

export const resolveStudentUploadControl = async (
  userId: string,
): Promise<ResolvedStudentUploadControl> => {
  await ensureStudentUploadControlSchema();

  const [student] = await db
    .select({
      classId: studentsTable.classId,
      className: classesTable.name,
    })
    .from(studentsTable)
    .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(eq(studentsTable.userId, userId))
    .limit(1);

  const config = await getStudentUploadControlConfig();
  const classOverride =
    student?.classId
      ? config.classes.find((item) => item.classId === student.classId) ?? null
      : null;

  if (classOverride) {
    return {
      scopeType: "class",
      classId: student.classId,
      className: student.className,
      documentUploadEnabled: classOverride.documentUploadEnabled,
      profileUploadEnabled: classOverride.profileUploadEnabled,
      requestedDocumentTypes: classOverride.requestedDocumentTypes,
      updatedAt: classOverride.updatedAt,
    };
  }

  return {
    scopeType: "all",
    classId: student?.classId ?? null,
    className: student?.className ?? null,
    documentUploadEnabled: config.all.documentUploadEnabled,
    profileUploadEnabled: config.all.profileUploadEnabled,
    requestedDocumentTypes: config.all.requestedDocumentTypes,
    updatedAt: config.all.updatedAt,
  };
};
