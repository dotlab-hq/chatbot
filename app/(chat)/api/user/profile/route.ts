import { NextResponse } from "next/server";
import { auth, betterAuthInstance } from "@/app/(auth)/auth";

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

    // Use Better Auth's API to update the user
    const updatedUser = await betterAuthInstance.api.updateUser({
      userId: session.user.id,
      update: updateData,
    });

    const u = updatedUser as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        image: (u.image as string) || null,
      },
    });
  } catch (error) {
    console.error("Failed to update user profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
