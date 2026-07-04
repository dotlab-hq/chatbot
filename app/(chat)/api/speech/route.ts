import { generateSpeech } from "ai";
import { openai } from "@ai-sdk/openai";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries/db";
import { chat, message } from "@/lib/db/schema";
import { getS3Client } from "@/lib/s3";

const SIGNED_URL_EXPIRES = 3600;

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messageId, chatId, text } = await request.json();

    if (!messageId || !chatId || !text) {
      return NextResponse.json(
        { error: "messageId, chatId, and text are required" },
        { status: 400 }
      );
    }

    // Verify the chat belongs to the user
    const [chatRow] = await db
      .select({ userId: chat.userId })
      .from(chat)
      .where(eq(chat.id, chatId))
      .limit(1);

    if (!chatRow || chatRow.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const s3 = getS3Client();
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      return NextResponse.json(
        { error: "S3_BUCKET env var is not set" },
        { status: 500 }
      );
    }

    const key = `users/${chatRow.userId}/conv/${chatId}/message/${messageId}/speech`;

    // Check if speech already exists in DB
    const [msgRow] = await db
      .select({ speechKey: message.speechKey })
      .from(message)
      .where(eq(message.id, messageId))
      .limit(1);

    if (msgRow?.speechKey && msgRow.speechKey !== "") {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: msgRow.speechKey }),
        { expiresIn: SIGNED_URL_EXPIRES }
      );
      return NextResponse.json({ url });
    }

    // Generate speech
    const result = await generateSpeech({
      model: openai.speech("canopylabs/orpheus-v1-english"),
      text,
      voice: "hannah",
      providerOptions: {
        openai: {
          responseFormat: "wav",
        },
      },
    });

    const audioData = result.audio.uint8Array;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: new Uint8Array(audioData),
        ContentType: "audio/wav",
      })
    );

    // Store the key in DB
    await db
      .update(message)
      .set({ speechKey: key })
      .where(eq(message.id, messageId));

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: SIGNED_URL_EXPIRES }
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Speech generation error:", error);
    return NextResponse.json(
      { error: "Speech generation failed" },
      { status: 500 }
    );
  }
}
