import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { createVectorStore, deleteVectorStore } from "@/lib/ai/vector-store";
import {
  createProject,
  deleteProjectById,
  getProjectsByUserId,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const projects = await getProjectsByUserId({ userId: session.user.id });
  return Response.json({ projects });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const body = await request.json();
  const { name, description } = body as {
    name: string;
    description?: string;
  };

  if (!name?.trim()) {
    return new ChatbotError(
      "bad_request:api",
      "Project name is required"
    ).toResponse();
  }

  // Create an OpenAI Vector Store for this project
  const vectorStoreId = await createVectorStore(name.trim());

  const project = await createProject({
    name: name.trim(),
    description: description?.trim() || undefined,
    userId: session.user.id,
    vectorStoreId,
  });

  return Response.json({ project }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return new ChatbotError(
      "bad_request:api",
      "Project ID is required"
    ).toResponse();
  }

  // Get project to find vector store ID before deleting
  const projects = await getProjectsByUserId({ userId: session.user.id });
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return new ChatbotError(
      "bad_request:api",
      "Project not found"
    ).toResponse();
  }

  // Delete the OpenAI vector store
  if (project.vectorStoreId) {
    try {
      await deleteVectorStore(project.vectorStoreId);
    } catch {
      // Vector store may already be deleted — continue with DB cleanup
    }
  }

  // Delete from DB (cascades to project files)
  await deleteProjectById({ id: projectId });

  return Response.json({ success: true });
}
