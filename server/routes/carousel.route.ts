import { Hono } from "hono";
import { eq, and, or, desc, asc, sql } from "drizzle-orm";
import { db } from "../db";
import { carouselItemsTable } from "../db/schemas/carousel";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { Role } from "../utils/roles";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";
import { randomUUID } from "crypto";
import { mkdir, unlink } from "fs/promises";
import * as path from "path";

const carouselRouter = new Hono();
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

// Public: Get all active carousel items
carouselRouter.get("/public", async (c) => {
  const now = new Date();

  try {
    const items = await db
      .select()
      .from(carouselItemsTable)
      .where(
        and(
          eq(carouselItemsTable.isActive, true),
          or(
            sql`${carouselItemsTable.startDate} IS NULL`,
            sql`${carouselItemsTable.startDate} <= ${now}`
          ),
          or(
            sql`${carouselItemsTable.endDate} IS NULL`,
            sql`${carouselItemsTable.endDate} >= ${now}`
          )
        )
      )
      .orderBy(asc(carouselItemsTable.displayOrder));

    return c.json<SuccessResponse>({
      success: true,
      message: "Carousel items retrieved successfully",
      data: items,
    });
  } catch (err) {
    console.error("Error retrieving carousel items:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to retrieve carousel items" },
      HttpStatus.InternalServerError
    );
  }
});

// Admin: Get all carousel items
carouselRouter.get(
  "/all",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const items = await db
        .select()
        .from(carouselItemsTable)
        .orderBy(desc(carouselItemsTable.createdAt));

      return c.json<SuccessResponse>({
        success: true,
        message: "Carousel items retrieved successfully",
        data: items,
      });
    } catch (err) {
      console.error("Error retrieving carousel items:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve carousel items" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Get single carousel item
carouselRouter.get(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const item = await db
        .select()
        .from(carouselItemsTable)
        .where(eq(carouselItemsTable.id, id))
        .limit(1);

      if (item.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Carousel item not found" },
          HttpStatus.NotFound
        );
      }

      return c.json<SuccessResponse>({
        success: true,
        message: "Carousel item retrieved successfully",
        data: item[0],
      });
    } catch (err) {
      console.error("Error retrieving carousel item:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve carousel item" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Create carousel item
carouselRouter.post(
  "/create",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const body = await c.req.parseBody({ all: true });

      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : null;
      const linkUrl =
        typeof body.linkUrl === "string" ? body.linkUrl.trim() : null;
      const displayOrder = parseInt(body.displayOrder as string) || 0;
      const isActive = body.isActive === "true";
      const startDate = body.startDate
        ? new Date(body.startDate as string)
        : null;
      const endDate = body.endDate ? new Date(body.endDate as string) : null;

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
        const carouselDir = path.join(uploadRootDir, "carousel");
        await mkdir(carouselDir, { recursive: true });

        const extension = getExtension(file.name) || ".jpg";
        const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
        const finalPath = path.join(carouselDir, savedFileName);
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await Bun.write(finalPath, fileBuffer);

        imageUrl = `/api/upload/carousel/${savedFileName}`;
      }

      if (!imageUrl) {
        return c.json<ErrorResponse>(
          { success: false, error: "Image is required" },
          HttpStatus.BadRequest
        );
      }

      const [created] = await db
        .insert(carouselItemsTable)
        .values({
          title,
          description,
          imageUrl,
          linkUrl,
          displayOrder,
          isActive,
          startDate,
          endDate,
        })
        .returning();

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Carousel item created successfully",
          data: created,
        },
        HttpStatus.Created
      );
    } catch (err) {
      console.error("Error creating carousel item:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create carousel item" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Update carousel item
carouselRouter.put(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select()
        .from(carouselItemsTable)
        .where(eq(carouselItemsTable.id, id))
        .limit(1);

      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Carousel item not found" },
          HttpStatus.NotFound
        );
      }

      const body = await c.req.parseBody({ all: true });

      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : null;
      const linkUrl =
        typeof body.linkUrl === "string" ? body.linkUrl.trim() : null;
      const displayOrder = parseInt(body.displayOrder as string);
      const isActive =
        body.isActive === "true"
          ? true
          : body.isActive === "false"
          ? false
          : undefined;
      const startDate = body.startDate
        ? new Date(body.startDate as string)
        : null;
      const endDate = body.endDate ? new Date(body.endDate as string) : null;

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
        const carouselDir = path.join(uploadRootDir, "carousel");
        await mkdir(carouselDir, { recursive: true });

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
        const finalPath = path.join(carouselDir, savedFileName);
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await Bun.write(finalPath, fileBuffer);

        imageUrl = `/api/upload/carousel/${savedFileName}`;
      }

      const [updated] = await db
        .update(carouselItemsTable)
        .set({
          title,
          description,
          imageUrl,
          linkUrl,
          displayOrder: isNaN(displayOrder)
            ? existing[0].displayOrder
            : displayOrder,
          isActive: isActive !== undefined ? isActive : existing[0].isActive,
          startDate,
          endDate,
        })
        .where(eq(carouselItemsTable.id, id))
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: "Carousel item updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating carousel item:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update carousel item" },
        HttpStatus.InternalServerError
      );
    }
  }
);

// Admin: Delete carousel item
carouselRouter.delete(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select()
        .from(carouselItemsTable)
        .where(eq(carouselItemsTable.id, id))
        .limit(1);

      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Carousel item not found" },
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

      await db.delete(carouselItemsTable).where(eq(carouselItemsTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Carousel item deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting carousel item:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete carousel item" },
        HttpStatus.InternalServerError
      );
    }
  }
);

export default carouselRouter;
