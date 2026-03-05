import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

export const carouselItemsTable = pgTable("carousel_items", {
  id: uuid().primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: varchar("imageUrl", { length: 500 }).notNull(),
  linkUrl: varchar("linkUrl", { length: 500 }),
  displayOrder: integer("displayOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  startDate: timestamp("startDate", { withTimezone: true }),
  endDate: timestamp("endDate", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdateFn(
    () => new Date()
  ),
});

export type CarouselItem = typeof carouselItemsTable.$inferSelect;
export type NewCarouselItem = typeof carouselItemsTable.$inferInsert;
