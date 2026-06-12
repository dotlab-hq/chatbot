import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { auth, betterAuthInstance } from "@/app/(auth)/auth";
import { getS3Client } from "@/lib/s3";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Avatar must be under 2MB" },
        { status: 400 }
      );
    }

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, or GIF allowed" },
        { status: 400 }
      );
    }

    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      return NextResponse.json(
        { error: "S3_BUCKET env var is not set" },
        { status: 500 }
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `avatars/${session.user.id}-${Date.now()}-${safeName}`;
    const fileBuffer = await file.arrayBuffer();

    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: new Uint8Array(fileBuffer),
        ContentType: file.type,
      })
    );

    const baseUrl = process.env.S3_PUBLIC_URL;
    const imageUrl = baseUrl
      ? `${baseUrl}/${key}`
      : `${process.env.AWS_ENDPOINT ?? `https://${bucket}.s3.${process.env.AWS_REGION ?? "us-east-1"}.amazonaws.com`}/${key}`;

    // Persist the avatar URL to the user record via Better Auth
    await betterAuthInstance.api.updateUser({
      userId: session.user.id,
      update: { image: imageUrl },
    });

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error("Avatar upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}
