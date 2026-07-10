import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { personalization, session, ssoProvider, user } from "@/lib/db/schema";

export async function DELETE() {
  try {
    const sess = await auth();

    if (!sess?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = sess.user.id;

    // Clean up related records (most have onDelete: cascade from user, but be explicit)
    await db.delete(session).where(eq(session.userId, userId));
    await db.delete(ssoProvider).where(eq(ssoProvider.userId, userId));
    await db.delete(personalization).where(eq(personalization.userId, userId));
    await db.delete(user).where(eq(user.id, userId));

    return NextResponse.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Failed to delete account:", error);
    return NextResponse.json(
      { message: "Failed to delete account" },
      { status: 500 }
    );
  }
}
