import { transcribe } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";

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
    const audio = formData.get("audio") as Blob;

    if (!audio) {
      return NextResponse.json({ error: "No audio file" }, { status: 400 });
    }

    if (audio.size === 0) {
      return NextResponse.json({ error: "Empty audio file" }, { status: 400 });
    }

    const buffer = await audio.arrayBuffer();
    const result = await transcribe({
      model: openai.transcription("whisper-1"),
      audio: new Uint8Array(buffer),
    });

    return NextResponse.json({ text: result.text });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
