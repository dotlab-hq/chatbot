import { eq } from "drizzle-orm";
import { type User, user } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";
import { db } from "./db";

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string) {
  try {
    const id = generateUUID();
    return await db
      .insert(user)
      .values({ id, name: email, email, type: "regular" })
      .returning({ id: user.id, email: user.email });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;

  try {
    return await db
      .insert(user)
      .values({
        id: generateUUID(),
        name: email,
        email,
        type: "guest",
      })
      .returning({ id: user.id, email: user.email });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function updateUserProfile({
  userId,
  name,
  email,
}: {
  userId: string;
  name?: string;
  email?: string;
}): Promise<User | null> {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) {
      updates.name = name;
    }
    if (email !== undefined) {
      updates.email = email;
    }

    const [updated] = await db
      .update(user)
      .set(updates)
      .where(eq(user.id, userId))
      .returning();
    return updated ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update user profile"
    );
  }
}

export async function getUserById({
  userId,
}: {
  userId: string;
}): Promise<User | null> {
  try {
    const [found] = await db.select().from(user).where(eq(user.id, userId));
    return found ?? null;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get user by id");
  }
}
