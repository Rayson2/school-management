import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

export const galleryCategoriesTable = pgTable("gallery_categories", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  displayOrder: integer("displayOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
    () => new Date()
  ),
});

export const galleryImagesTable = pgTable("gallery_images", {
  id: uuid().primaryKey().defaultRandom(),
  categoryId: uuid("categoryId").references(() => galleryCategoriesTable.id, {
    onDelete: "cascade",
  }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: varchar("imageUrl", { length: 500 }).notNull(),
  thumbnailUrl: varchar("thumbnailUrl", { length: 500 }),
  altText: varchar("altText", { length: 255 }),
  displayOrder: integer("displayOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  eventDate: timestamp("eventDate", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
    () => new Date()
  ),
});

export type GalleryCategory = typeof galleryCategoriesTable.$inferSelect;
export type NewGalleryCategory = typeof galleryCategoriesTable.$inferInsert;
export type GalleryImage = typeof galleryImagesTable.$inferSelect;
export type NewGalleryImage = typeof galleryImagesTable.$inferInsert;
