import { Hono } from "hono";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { certificateTemplatesTable } from "../db/schemas/certificates";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { Role } from "../utils/roles";
import { ErrorResponse, HttpStatus, SuccessResponse } from "../utils/types";
import { randomUUID } from "crypto";
import { mkdir, unlink } from "fs/promises";
import * as path from "path";

const certificateRouter = new Hono();
const uploadRootDir = path.join(process.cwd(), "server", "upload");

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

const parseFieldConfigJson = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return "[]";
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
};

certificateRouter.get(
  "/all",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const templates = await db
        .select()
        .from(certificateTemplatesTable)
        .orderBy(desc(certificateTemplatesTable.createdAt));

      return c.json<SuccessResponse>({
        success: true,
        message: "Certificate templates retrieved successfully",
        data: templates,
      });
    } catch (err) {
      console.error("Error retrieving certificate templates:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to retrieve certificate templates" },
        HttpStatus.InternalServerError
      );
    }
  }
);

certificateRouter.get("/public", async (c) => {
  try {
    const templates = await db
      .select()
      .from(certificateTemplatesTable)
      .where(eq(certificateTemplatesTable.isActive, true))
      .orderBy(asc(certificateTemplatesTable.name));

    return c.json<SuccessResponse>({
      success: true,
      message: "Certificate templates retrieved successfully",
      data: templates,
    });
  } catch (err) {
    console.error("Error retrieving certificate templates:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to retrieve certificate templates" },
      HttpStatus.InternalServerError
    );
  }
});

certificateRouter.post(
  "/create",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    try {
      const body = await c.req.parseBody({ all: true });

      const name = typeof body.name === "string" ? body.name.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : null;
      const isActive = body.isActive === "true";
      const fieldConfigJson = parseFieldConfigJson(body.fieldConfigJson);

      if (!name) {
        return c.json<ErrorResponse>(
          { success: false, error: "Template name is required" },
          HttpStatus.BadRequest
        );
      }
      if (fieldConfigJson === null) {
        return c.json<ErrorResponse>(
          { success: false, error: "Field config must be a JSON array" },
          HttpStatus.BadRequest
        );
      }

      const duplicate = await db
        .select({ id: certificateTemplatesTable.id })
        .from(certificateTemplatesTable)
        .where(eq(certificateTemplatesTable.name, name))
        .limit(1);
      if (duplicate.length > 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Template name already exists" },
          HttpStatus.Conflict
        );
      }

      const file = body.templateImage instanceof File ? body.templateImage : null;
      if (!file || !file.name || file.size === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Template image is required" },
          HttpStatus.BadRequest
        );
      }

      const certificateDir = path.join(uploadRootDir, "certificates");
      await mkdir(certificateDir, { recursive: true });
      const extension = getExtension(file.name) || ".jpg";
      const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
      const finalPath = path.join(certificateDir, savedFileName);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      await Bun.write(finalPath, fileBuffer);
      const templateImageUrl = `/api/upload/certificates/${savedFileName}`;

      const [created] = await db
        .insert(certificateTemplatesTable)
        .values({
          name,
          description,
          templateImageUrl,
          fieldConfigJson,
          isActive,
        })
        .returning();

      return c.json<SuccessResponse>(
        {
          success: true,
          message: "Certificate template created successfully",
          data: created,
        },
        HttpStatus.Created
      );
    } catch (err) {
      console.error("Error creating certificate template:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to create certificate template" },
        HttpStatus.InternalServerError
      );
    }
  }
);

certificateRouter.put(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select()
        .from(certificateTemplatesTable)
        .where(eq(certificateTemplatesTable.id, id))
        .limit(1);
      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Certificate template not found" },
          HttpStatus.NotFound
        );
      }

      const body = await c.req.parseBody({ all: true });
      const current = existing[0];

      const name =
        typeof body.name === "string" ? body.name.trim() : current.name;
      const description =
        typeof body.description === "string"
          ? body.description.trim()
          : current.description;
      const isActive =
        body.isActive === "true"
          ? true
          : body.isActive === "false"
          ? false
          : current.isActive;
      const fieldConfigJsonRaw =
        typeof body.fieldConfigJson === "string"
          ? body.fieldConfigJson
          : current.fieldConfigJson;
      const fieldConfigJson = parseFieldConfigJson(fieldConfigJsonRaw);

      if (!name) {
        return c.json<ErrorResponse>(
          { success: false, error: "Template name is required" },
          HttpStatus.BadRequest
        );
      }
      if (fieldConfigJson === null) {
        return c.json<ErrorResponse>(
          { success: false, error: "Field config must be a JSON array" },
          HttpStatus.BadRequest
        );
      }

      const duplicate = await db
        .select({ id: certificateTemplatesTable.id })
        .from(certificateTemplatesTable)
        .where(eq(certificateTemplatesTable.name, name))
        .limit(1);
      if (duplicate.length > 0 && duplicate[0].id !== id) {
        return c.json<ErrorResponse>(
          { success: false, error: "Template name already exists" },
          HttpStatus.Conflict
        );
      }

      let templateImageUrl = current.templateImageUrl;
      const file = body.templateImage instanceof File ? body.templateImage : null;
      if (file && file.name && file.size > 0) {
        const certificateDir = path.join(uploadRootDir, "certificates");
        await mkdir(certificateDir, { recursive: true });

        if (current.templateImageUrl) {
          try {
            await unlink(parseLocalPathFromFileUrl(current.templateImageUrl));
          } catch {
            // Ignore delete failure for old file
          }
        }

        const extension = getExtension(file.name) || ".jpg";
        const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
        const finalPath = path.join(certificateDir, savedFileName);
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await Bun.write(finalPath, fileBuffer);
        templateImageUrl = `/api/upload/certificates/${savedFileName}`;
      }

      const [updated] = await db
        .update(certificateTemplatesTable)
        .set({
          name,
          description,
          fieldConfigJson,
          templateImageUrl,
          isActive,
        })
        .where(eq(certificateTemplatesTable.id, id))
        .returning();

      return c.json<SuccessResponse>({
        success: true,
        message: "Certificate template updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating certificate template:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to update certificate template" },
        HttpStatus.InternalServerError
      );
    }
  }
);

certificateRouter.delete(
  "/:id",
  requireAuth,
  requireRoles([Role.ADMIN]),
  async (c) => {
    const id = c.req.param("id");

    try {
      const existing = await db
        .select()
        .from(certificateTemplatesTable)
        .where(eq(certificateTemplatesTable.id, id))
        .limit(1);
      if (existing.length === 0) {
        return c.json<ErrorResponse>(
          { success: false, error: "Certificate template not found" },
          HttpStatus.NotFound
        );
      }

      if (existing[0].templateImageUrl) {
        try {
          await unlink(parseLocalPathFromFileUrl(existing[0].templateImageUrl));
        } catch {
          // Ignore if file is missing
        }
      }

      await db
        .delete(certificateTemplatesTable)
        .where(eq(certificateTemplatesTable.id, id));

      return c.json<SuccessResponse>({
        success: true,
        message: "Certificate template deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting certificate template:", err);
      return c.json<ErrorResponse>(
        { success: false, error: "Failed to delete certificate template" },
        HttpStatus.InternalServerError
      );
    }
  }
);

export default certificateRouter;
