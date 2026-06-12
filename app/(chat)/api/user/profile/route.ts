import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, image } = body as {
      name?: string;
      email?: string;
      image?: string | null;
    };

    const updateData: Record<string, string | null> = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (email !== undefined) {
      updateData.email = email;
    }

    if (image !== undefined) {
      updateData.image = image;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Use Drizzle directly to update the user
    await db
      .update(user)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({
      success: true,
      user: { id: session.user.id, ...updateData },
    });
  } catch (error) {
    console.error("Failed to update user profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
