import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  boolean,
} from "drizzle-orm/pg-core";

export const certificateTemplatesTable = pgTable("certificate_templates", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar("name", { length: 150 }).notNull().unique(),
  description: text("description"),
  templateImageUrl: varchar("templateImageUrl", { length: 500 }).notNull(),
  fieldConfigJson: text("fieldConfigJson").notNull().default("[]"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
    () => new Date()
  ),
});

export type CertificateTemplate =
  typeof certificateTemplatesTable.$inferSelect;
export type NewCertificateTemplate =
  typeof certificateTemplatesTable.$inferInsert;
