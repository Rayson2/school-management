import { sql } from "drizzle-orm";
import { db } from "../db";

export const documentStatusOptions = ["pending", "approved", "rejected"] as const;
export type DocumentStatus = (typeof documentStatusOptions)[number];

let ensureDocumentSchemaPromise: Promise<void> | null = null;

export const ensureDocumentSchema = async () => {
  if (!ensureDocumentSchemaPromise) {
    ensureDocumentSchemaPromise = (async () => {
      await db.execute(
        sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS status varchar(30) NOT NULL DEFAULT 'pending'`,
      );
      await db.execute(
        sql`UPDATE documents SET status = 'pending' WHERE status IS NULL OR status = ''`,
      );
    })().catch((err) => {
      ensureDocumentSchemaPromise = null;
      throw err;
    });
  }

  await ensureDocumentSchemaPromise;
};

export const sanitizeDocumentStatus = (value: string): DocumentStatus | null => {
  const normalized = value.trim().toLowerCase();
  return documentStatusOptions.includes(normalized as DocumentStatus)
    ? (normalized as DocumentStatus)
    : null;
};
