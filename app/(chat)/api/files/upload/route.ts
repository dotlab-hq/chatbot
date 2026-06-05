import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

function getS3Client() {
  console.log("[S3 Init] Building S3 client...");
  console.log("[S3 Init] AWS_REGION:", process.env.AWS_REGION ? "SET" : "NOT SET");
  console.log("[S3 Init] AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID ? "SET" : "NOT SET");
  console.log("[S3 Init] AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? "SET" : "NOT SET");
  console.log("[S3 Init] AWS_ENDPOINT:", process.env.AWS_ENDPOINT ?? "NOT SET");
  console.log("[S3 Init] S3_BUCKET:", process.env.S3_BUCKET ?? "NOT SET");
  console.log("[S3 Init] S3_PUBLIC_URL:", process.env.S3_PUBLIC_URL ?? "NOT SET");

  const s3Config: {
    region: string;
    endpoint?: string;
    forcePathStyle?: boolean;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  } = {
    region: process.env.AWS_REGION ?? "us-east-1",
  };

  if (process.env.AWS_ENDPOINT) {
    s3Config.endpoint = process.env.AWS_ENDPOINT;
    s3Config.forcePathStyle = true;

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      s3Config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }
  }

  return new S3Client(s3Config);
}

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    .refine((file) => ["image/jpeg", "image/png"].includes(file.type), {
      message: "File type should be JPEG or PNG",
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileBuffer = await file.arrayBuffer();

    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      return NextResponse.json(
        { error: "S3_BUCKET env var is not set" },
        { status: 500 }
      );
    }

    const key = `uploads/${Date.now()}-${safeName}`;
    const contentType = (formData.get("file") as File).type;

    try {
      const s3 = getS3Client();
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: new Uint8Array(fileBuffer),
          ContentType: contentType,
        })
      );
      console.log(`File uploaded successfully: ${key}`);

      const baseUrl = process.env.S3_PUBLIC_URL;
      const url = baseUrl
        ? `${baseUrl}/${key}`
        : `${process.env.AWS_ENDPOINT ?? `https://${bucket}.s3.${process.env.AWS_REGION ?? "us-east-1"}.amazonaws.com`}/${key}`;

      return NextResponse.json({ url, pathname: key, contentType });
    } catch (_error) {
      console.log("S3 upload error:", _error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
