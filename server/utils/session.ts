import { eq } from "drizzle-orm";
import { db } from "../db";
import { sessionTable } from "../db/schemas/sessions";
import { usersTable } from "../db/schemas/users";

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expDays = 7;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * expDays);

  try {
    await db.insert(sessionTable).values({ token, userId, expiresAt });
    return token;
  } catch (error) {
    console.error("Error creating session:", error);
    throw new Error("Failed to create session");
  }
}

export async function getUserFromSesson(session: string) {
  try {
    const result = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, session));
    if (result.length === 0) {
      return null;
    }
    const sessionData = result[0];
    if (sessionData.expiresAt < new Date()) {
      // session expired, delete it from database
      await db.delete(sessionTable).where(eq(sessionTable.token, session));
      return null;
    }
    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, sessionData.userId));
    return user[0];
  } catch (error) {
    console.error("Error retrieving session:", error);
    throw new Error("Failed to retrieve session");
  }
}
