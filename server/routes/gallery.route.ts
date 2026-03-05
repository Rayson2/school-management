import { Hono } from "hono";
import { eq, and, or, desc, asc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  galleryCategoriesTable,
  galleryImagesTable,
} from "../db/schemas/gallery";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { Role } from "../utils/roles";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";
import { randomUUID } from "crypto";
import { mkdir, unlink } from "fs/promises";
import * as path from "path";

const galleryRouter = new Hono();
const uploadRootDir = path.join(process.cwd(), "server", "upload");

const sanitizePathSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "cms";

const getExtension = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();
  return extension.length <= 10 ? extension : "";
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

// ==================== CATEGORIES ====================

// Public: Get all active categories
galleryRouter.get("/categories/public", async (c) => {
  try {
    const categories = await db
      .select()
      .from(galleryCategoriesTable)
      .where(eq(galleryCategoriesTable.isActive, true))
      .orderBy(asc(galleryCategoriesTable.displayOrder));

    return c.json<SuccessResponse>({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
    });
  } catch (err) {
    console.error("Error retrieving categories:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to retrieve categories" },
      HttpStatus.InternalServerError
    );
  }
});

// Admin: Get all categories
galleryRouter.get(
  "/categories/all",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const categories = await db
        .select()
        .from(galleryCategoriesTable)
        .orderBy(desc(galleryCategoriesTable.createdAt));

      return c.json<SuccessResponse>({
        success: true,
        message: "Categories retrieved successfully",
        data: categories,
      });
    } catch (err) {
      console.error("Error retrieving categories:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve categories" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Create category
galleryRouter.post(
  "/categories/create",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const body = await c.req.json();
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : null;
      const displayOrder = parseInt(body.displayOrder) || 0;
      const isActive = body.isActive === true;

      if (!name) {
        return c.json<ErrorResponse>(
          { success: false, error: "Category name is required" },
          HttpStatus.BadRequest
        );
      }

      const existing = await db
        .select({ id: galleryCategoriesTable.id })
        .from(galleryCategoriesTable)
        .where(eq(galleryCategoriesTable.name, name))
        .limit(1);

      if (existing.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Category already exists" },
          HttpStatus.Conflict
        );
      }

      const [created] = await db
        .insert(galleryCategoriesTable)
        .values({
          name,
          description,
          displayOrder,
          isActive,
        })
        .returning();

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Category created successfully",
          data: created,
        },
        HttpStatus.Created
      );
    } catch (err) {
      console.error("Error creating category:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create category" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Update category
galleryRouter.put(
  "/categories/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select()
        .from(galleryCategoriesTable)
        .where(eq(galleryCategoriesTable.id, id))
        .limit(1);

      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Category not found" },
          HttpStatus.NotFound
        );
      }

      const body = await c.req.json();
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : null;
      const displayOrder = parseInt(body.displayOrder);
      const isActive =
        body.isActive === true || body.isActive === false
          ? body.isActive
          : undefined;

      if (!name) {
        return c.json<ErrorResponse>(
          { success: false, error: "Category name is required" },
          HttpStatus.BadRequest
        );
      }

      const duplicate = await db
        .select({ id: galleryCategoriesTable.id })
        .from(galleryCategoriesTable)
        .where(
          and(
            eq(galleryCategoriesTable.name, name),
            sql`${galleryCategoriesTable.id} <> ${id}`
          )
        )
        .limit(1);

      if (duplicate.length) {
        return c.json<ErrorResponse>(
          { success: false, error: "Category name already exists" },
          HttpStatus.Conflict
        );
      }

      const [updated] = await db
        .update(galleryCategoriesTable)
        .set({
          name,
          description,
          displayOrder: isNaN(displayOrder)
            ? existing[0].displayOrder
            : displayOrder,
          isActive: isActive !== undefined ? isActive : existing[0].isActive,
        })
        .where(eq(galleryCategoriesTable.id, id))
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: "Category updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating category:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update category" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Delete category
galleryRouter.delete(
  "/categories/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select()
        .from(galleryCategoriesTable)
        .where(eq(galleryCategoriesTable.id, id))
        .limit(1);

      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Category not found" },
          HttpStatus.NotFound
        );
      }

      // Delete associated images first
      const images = await db
        .select()
        .from(galleryImagesTable)
        .where(eq(galleryImagesTable.categoryId, id));

      for (const img of images) {
        if (img.imageUrl) {
          try {
            await unlink(parseLocalPathFromFileUrl(img.imageUrl));
          } catch {
            // Ignore if file doesn't exist
          }
        }
      }

      await db
        .delete(galleryImagesTable)
        .where(eq(galleryImagesTable.categoryId, id));
      await db
        .delete(galleryCategoriesTable)
        .where(eq(galleryCategoriesTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting category:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete category" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// ==================== IMAGES ====================

// Public: Get all active images
galleryRouter.get("/images/public", async (c) => {
  const categoryId = c.req.query("categoryId");

  try {
    const whereClause = categoryId
      ? and(
          eq(galleryImagesTable.isActive, true),
          eq(galleryImagesTable.categoryId, categoryId)
        )
      : eq(galleryImagesTable.isActive, true);

    const images = await db
      .select()
      .from(galleryImagesTable)
      .where(whereClause)
      .orderBy(asc(galleryImagesTable.displayOrder));

    return c.json<SuccessResponse>({
      success: true,
      message: "Images retrieved successfully",
      data: images,
    });
  } catch (err) {
    console.error("Error retrieving images:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to retrieve images" },
      HttpStatus.InternalServerError
    );
  }
});

// Admin: Get all images
galleryRouter.get(
  "/images/all",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const categoryId = c.req.query("categoryId");

    try {
      const whereClause = categoryId
        ? eq(galleryImagesTable.categoryId, categoryId)
        : undefined;

      const images = await db
        .select()
        .from(galleryImagesTable)
        .where(whereClause)
        .orderBy(desc(galleryImagesTable.createdAt));

      return c.json<SuccessResponse>({
        success: true,
        message: "Images retrieved successfully",
        data: images,
      });
    } catch (err) {
      console.error("Error retrieving images:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve images" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Get single image
galleryRouter.get(
  "/images/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const image = await db
        .select()
        .from(galleryImagesTable)
        .where(eq(galleryImagesTable.id, id))
        .limit(1);

      if (image.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Image not found" },
          HttpStatus.NotFound
        );
      }

      return c.json<SuccessResponse>({
        success: true,
        message: "Image retrieved successfully",
        data: image[0],
      });
    } catch (err) {
      console.error("Error retrieving image:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve image" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Create image
galleryRouter.post(
  "/images/create",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const body = await c.req.parseBody({ all: true });

      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : null;
      const altText =
        typeof body.altText === "string" ? body.altText.trim() : null;
      const categoryId =
        typeof body.categoryId === "string" ? body.categoryId.trim() : null;
      const displayOrder = parseInt(body.displayOrder as string) || 0;
      const isActive = body.isActive === "true";
      const eventDate = body.eventDate
        ? new Date(body.eventDate as string)
        : null;

      if (!title) {
        return c.json<ErrorResponse>(
          { success: false, error: "Title is required" },
          HttpStatus.BadRequest
        );
      }

      // Handle file upload
      const file = body.image instanceof File ? body.image : null;
      let imageUrl = body.imageUrl as string;

      if (file && file.name && file.size > 0) {
        const galleryDir = path.join(uploadRootDir, "gallery");
        await mkdir(galleryDir, { recursive: true });

        const extension = getExtension(file.name) || ".jpg";
        const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
        const finalPath = path.join(galleryDir, savedFileName);
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await Bun.write(finalPath, fileBuffer);

        imageUrl = `/api/upload/gallery/${savedFileName}`;
      }

      if (!imageUrl) {
        return c.json<ErrorResponse>(
          { success: false, error: "Image is required" },
          HttpStatus.BadRequest
        );
      }

      const [created] = await db
        .insert(galleryImagesTable)
        .values({
          title,
          description,
          altText,
          categoryId: categoryId || null,
          imageUrl,
          displayOrder,
          isActive,
          eventDate,
        })
        .returning();

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Image created successfully",
          data: created,
        },
        HttpStatus.Created
      );
    } catch (err) {
      console.error("Error creating image:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create image" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Update image
galleryRouter.put(
  "/images/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select()
        .from(galleryImagesTable)
        .where(eq(galleryImagesTable.id, id))
        .limit(1);

      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Image not found" },
          HttpStatus.NotFound
        );
      }

      const body = await c.req.parseBody({ all: true });

      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : null;
      const altText =
        typeof body.altText === "string" ? body.altText.trim() : null;
      const categoryId =
        typeof body.categoryId === "string" ? body.categoryId.trim() : null;
      const displayOrder = parseInt(body.displayOrder as string);
      const isActive =
        body.isActive === "true"
          ? true
          : body.isActive === "false"
          ? false
          : undefined;
      const eventDate = body.eventDate
        ? new Date(body.eventDate as string)
        : null;

      if (!title) {
        return c.json<ErrorResponse>(
          { success: false, error: "Title is required" },
          HttpStatus.BadRequest
        );
      }

      // Handle file upload if new file provided
      let imageUrl = existing[0].imageUrl;
      const file = body.image instanceof File ? body.image : null;

      if (file && file.name && file.size > 0) {
        const galleryDir = path.join(uploadRootDir, "gallery");
        await mkdir(galleryDir, { recursive: true });

        // Delete old file
        if (existing[0].imageUrl) {
          try {
            await unlink(parseLocalPathFromFileUrl(existing[0].imageUrl));
          } catch {
            // Ignore if file doesn't exist
          }
        }

        const extension = getExtension(file.name) || ".jpg";
        const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
        const finalPath = path.join(galleryDir, savedFileName);
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await Bun.write(finalPath, fileBuffer);

        imageUrl = `/api/upload/gallery/${savedFileName}`;
      }

      const [updated] = await db
        .update(galleryImagesTable)
        .set({
          title,
          description,
          altText,
          categoryId: categoryId || null,
          imageUrl,
          displayOrder: isNaN(displayOrder)
            ? existing[0].displayOrder
            : displayOrder,
          isActive: isActive !== undefined ? isActive : existing[0].isActive,
          eventDate,
        })
        .where(eq(galleryImagesTable.id, id))
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: "Image updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating image:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update image" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Delete image
galleryRouter.delete(
  "/images/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select()
        .from(galleryImagesTable)
        .where(eq(galleryImagesTable.id, id))
        .limit(1);

      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Image not found" },
          HttpStatus.NotFound
        );
      }

      // Delete file
      if (existing[0].imageUrl) {
        try {
          await unlink(parseLocalPathFromFileUrl(existing[0].imageUrl));
        } catch {
          // Ignore if file doesn't exist
        }
      }

      await db.delete(galleryImagesTable).where(eq(galleryImagesTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Image deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting image:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete image" },
        HttpStatus.InternalServerError
      );
    }
  }
);

export default galleryRouter;
