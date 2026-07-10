import { NextResponse } from "next/server";
import { betterAuthInstance } from "@/app/(auth)/auth";

export async function PATCH(request: Request) {
  try {
    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: "Current and new passwords are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const result = await betterAuthInstance.api.changePassword({
      userId: session.user.id,
      newPassword,
      currentPassword,
    });

    return NextResponse.json({ message: "Password updated successfully", ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update password";
    const status = message.toLowerCase().includes("incorrect") ? 401 : 500;
    return NextResponse.json({ message }, { status });
  }
}
