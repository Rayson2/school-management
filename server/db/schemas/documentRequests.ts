import {
  boolean,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const documentRequestTypesTable = pgTable(
  "document_request_types",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: varchar("description", { length: 500 }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
      () => new Date(),
    ),
  },
  (table) => ({
    slugUniqueIdx: uniqueIndex("document_request_types_slug_idx").on(table.slug),
  }),
);

export const documentRequestsTable = pgTable(
  "document_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    requestTypeId: uuid("requestTypeId")
      .notNull()
      .references(() => documentRequestTypesTable.id),
    targetGroup: varchar("targetGroup", { length: 30 }).notNull(),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
      () => new Date(),
    ),
  },
  (table) => ({
    requestTypeTargetUniqueIdx: uniqueIndex("document_requests_target_type_idx").on(
      table.requestTypeId,
      table.targetGroup,
    ),
  }),
);

export type DocumentRequestType = typeof documentRequestTypesTable.$inferSelect;
export type DocumentRequest = typeof documentRequestsTable.$inferSelect;
