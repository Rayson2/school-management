import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { validateLogin } from "../middlewares/validation.middlware";
import { db } from "../db";
import { usersTable } from "../db/schemas/users";
import { eq } from "drizzle-orm";
import { compare, hashSync } from "bcryptjs";
import { createSession } from "../utils/session";
import { cookieOptions } from "../config/cookie-options";
import { requireAuth } from "../middlewares/auth.middleware";
import { sessionTable } from "../db/schemas/sessions";
import { HttpStatus, SuccessResponse, ErrorResponse } from "../utils/types";
import { studentsTable } from "../db/schemas/students";
import { teachersTable } from "../db/schemas/teachers";
import { mkdir, unlink } from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";

const authRouter = new Hono();
const uploadRootDir = path.join(process.cwd(), "server", "upload");

const sanitizePathSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";

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

authRouter.post("/login", validateLogin, async (c) => {
  const { username, password } = c.req.valid("json");
  const existUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (existUser.length === 0) {
    return c.json<ErrorResponse>(
      { success: false, error: "Invalid username or password" },
      HttpStatus.Unauthorized,
    );
  }

  const user = existUser[0];
  const validPassword = await compare(password, user.password);

  if (!validPassword) {
    return c.json<ErrorResponse>(
      { success: false, error: "Invalid username or password" },
      HttpStatus.Unauthorized,
    );
  }

  try {
    const token = await createSession(user.id);

    setCookie(c, "session", token, cookieOptions);

    return c.json<SuccessResponse>(
      {
        success: true,
        message: "Login successful",
      },
      HttpStatus.Ok,
    );
  } catch (error) {
    console.error("Login error:", error);
    return c.json<ErrorResponse>(
      { success: false, error: "An error occurred during login" },
      HttpStatus.InternalServerError,
    );
  }
});

authRouter.delete("/logout", async (c) => {
  const sessionToken = getCookie(c, "session");
  if (!sessionToken) {
    return c.json<SuccessResponse>({ success: true, message: "Logged out successfully" }, HttpStatus.Ok);
  }

  await db
    .delete(sessionTable)
    .where(eq(sessionTable.token, sessionToken as string));
  deleteCookie(c, "session");

  return c.json<SuccessResponse>({
    success: true,
    message: "Logged out successfully",
  });
});

authRouter.get("/me", requireAuth, (c) => {
  const user = c.get("user");
  const roles = c.get("userRole");
  
  return c.json<SuccessResponse>({
    success: true,
    message: "User retrieved successfully",
    data: { ...user, roles },
  });
});

authRouter.get("/profile", requireAuth, async (c) => {
  const user = c.get("user") as { id: string };
  const roles = (c.get("userRole") as string[]) ?? [];

  try {
    const [profileUser] = await db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    if (!profileUser) {
      return c.json<ErrorResponse>(
        { success: false, error: "User not found" },
        HttpStatus.NotFound,
      );
    }

    const [studentProfile, teacherProfile] = await Promise.all([
      db
        .select()
        .from(studentsTable)
        .where(eq(studentsTable.userId, user.id))
        .limit(1),
      db
        .select()
        .from(teachersTable)
        .where(eq(teachersTable.userId, user.id))
        .limit(1),
    ]);

    return c.json<SuccessResponse>({
      success: true,
      message: "Profile retrieved successfully",
      data: {
        ...profileUser,
        roles,
        studentProfile: studentProfile[0] ?? null,
        teacherProfile: teacherProfile[0] ?? null,
      },
    });
  } catch (err) {
    console.error("Error retrieving profile:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to retrieve profile" },
      HttpStatus.InternalServerError,
    );
  }
});

authRouter.put("/profile", requireAuth, async (c) => {
  const user = c.get("user") as { id: string };
  const body = await c.req.json().catch(() => ({}));
  const fullName =
    typeof body?.fullName === "string" ? body.fullName.trim() : "";

  if (!fullName) {
    return c.json<ErrorResponse>(
      { success: false, error: "Full name is required" },
      HttpStatus.BadRequest,
    );
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ fullName })
      .where(eq(usersTable.id, user.id))
      .returning({
        id: usersTable.id,
        fullName: usersTable.fullName,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      });

    return c.json<SuccessResponse>({
      success: true,
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to update profile" },
      HttpStatus.InternalServerError,
    );
  }
});

authRouter.post("/change-password", requireAuth, async (c) => {
  const user = c.get("user") as { id: string };
  const body = await c.req.json().catch(() => ({}));
  const currentPassword =
    typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return c.json<ErrorResponse>(
      { success: false, error: "Current password and new password are required" },
      HttpStatus.BadRequest,
    );
  }

  try {
    const existing = await db
      .select({ password: usersTable.password })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    if (!existing.length) {
      return c.json<ErrorResponse>(
        { success: false, error: "User not found" },
        HttpStatus.NotFound,
      );
    }

    const isValidCurrent = await compare(currentPassword, existing[0].password);
    if (!isValidCurrent) {
      return c.json<ErrorResponse>(
        { success: false, error: "Current password is incorrect" },
        HttpStatus.BadRequest,
      );
    }

    await db
      .update(usersTable)
      .set({
        password: hashSync(newPassword, 12),
      })
      .where(eq(usersTable.id, user.id));

    return c.json<SuccessResponse>({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("Error changing password:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to change password" },
      HttpStatus.InternalServerError,
    );
  }
});

authRouter.post("/profile-pic", requireAuth, async (c) => {
  const user = c.get("user") as { id: string; username?: string };

  try {
    const existingUser = await db
      .select({ avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    const previousAvatarUrl = existingUser[0]?.avatarUrl ?? null;

    const body = await c.req.parseBody({ all: true });
    const file =
      body.avatar instanceof File
        ? body.avatar
        : body.file instanceof File
          ? body.file
          : null;

    if (!file || !file.name || file.size === 0) {
      return c.json<ErrorResponse>(
        { success: false, error: "Profile image file is required" },
        HttpStatus.BadRequest,
      );
    }

    const userFolder = sanitizePathSegment(user.username || user.id);
    const profileDir = path.join(uploadRootDir, userFolder);
    await mkdir(profileDir, { recursive: true });

    const extension = getExtension(file.name) || ".jpg";
    const savedFileName = `${Date.now()}-${randomUUID()}${extension}`;
    const finalPath = path.join(profileDir, savedFileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await Bun.write(finalPath, fileBuffer);

    const avatarUrl = `/api/upload/${userFolder}/${savedFileName}`;
    const [updated] = await db
      .update(usersTable)
      .set({ avatarUrl })
      .where(eq(usersTable.id, user.id))
      .returning({
        id: usersTable.id,
        fullName: usersTable.fullName,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      });

    if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
      try {
        await unlink(parseLocalPathFromFileUrl(previousAvatarUrl));
      } catch {
        // Keep update successful even when previous file is already missing.
      }
    }

    return c.json<SuccessResponse>({
      success: true,
      message: "Profile picture updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error uploading profile picture:", err);
    return c.json<ErrorResponse>(
      { success: false, error: "Failed to upload profile picture" },
      HttpStatus.InternalServerError,
    );
  }
});

export default authRouter;
