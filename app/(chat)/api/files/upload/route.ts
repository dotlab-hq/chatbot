import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { uploadFile } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

const FileSchema = z.object({
  file: z.instanceof(Blob).refine((file) => file.size <= 50 * 1024 * 1024, {
    message: "File size should be less than 50MB",
  }),
});

/**
 * Upload a file to all configured AI providers and return merged references.
 * The caller uses `providerReference` (a Record<string, string>) to send the
 * file to any supported provider at inference time — no S3 URL required.
 */
async function uploadToProviders(params: {
  data: Uint8Array;
  filename: string;
  mediaType: string;
}): Promise<Record<string, string>> {
  const { data, filename, mediaType } = params;

  // Build a list of provider upload promises. Each entry is a
  // [providerName, uploadResult] tuple. Providers that aren't configured will
  // throw at import-time, so we swallow those errors gracefully.
  const providers: Array<{
    name: string;
    api: Parameters<typeof uploadFile>[0]["api"];
  }> = [
    { name: "openai", api: openai },
    { name: "anthropic", api: anthropic },
  ];

  const results = await Promise.allSettled(
    providers.map(async ({ name, api }) => {
      const result = await uploadFile({
        api,
        data,
        filename,
        mediaType,
        providerOptions: {
          [name]: name === "openai" ? { purpose: "assistants" } : undefined,
        },
      });
      return [name, result.providerReference] as const;
    })
  );

  const merged: Record<string, string> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      const [, ref] = r.value;
      // ref is a Record<string, string> keyed by provider — flatten it
      Object.assign(merged, ref);
    } else {
      console.warn("[file-upload] provider upload failed:", r.reason);
    }
  }

  return merged;
}

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
    const mediaType =
      (formData.get("file") as File).type || "application/octet-stream";
    const fileBuffer = await file.arrayBuffer();

    try {
      const providerReference = await uploadToProviders({
        data: new Uint8Array(fileBuffer),
        filename,
        mediaType,
      });

      if (Object.keys(providerReference).length === 0) {
        return NextResponse.json(
          { error: "No provider accepted the file upload" },
          { status: 500 }
        );
      }

      console.log(
        `File uploaded to providers: ${Object.keys(providerReference).join(", ")} —`,
        filename
      );

      return NextResponse.json({ providerReference, mediaType, filename });
    } catch (_error) {
      console.log("Provider upload error:", _error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
