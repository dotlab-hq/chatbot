# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chatbot is a full-stack AI chat application built with Next.js 16 App Router, React 19, and the Vercel AI SDK v7. It uses the Vercel AI Gateway for multi-provider LLM access, Drizzle ORM with PostgreSQL for persistence, and better-auth for authentication with organization/SSO support.

## Commands

- `pnpm dev` — start dev server (Turbo mode)
- `pnpm build` — production build
- `pnpm check` / `pnpm fix` — lint/fix via Biome (ultracite wrapper)
- `pnpm test` — Playwright E2E tests (requires `PLAYWRIGHT=True` env)
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:push` — Drizzle Kit schema management
- `pnpm db:studio` — Drizzle Kit visual DB editor

Tests are in `tests/e2e/` and use Playwright with Desktop Chrome. The test suite starts the dev server automatically. Tests use mock models (see `lib/ai/models.mock.ts` and `tests/prompts/utils.ts`).

## Code Navigation — graphify

**Always use graphify to look up symbols before doing broad codebase exploration.** The AST index lives at `graphify-out/graph.json`.

- `graphify query graphify-out/graph.json <name>` — find a symbol by name (case-insensitive)
- `graphify auto-update` — refresh the index from git diff + untracked files
- `graphify build .` — full rebuild (rare, only when index is stale beyond incremental)

Prefer graphify over Glob/Grep when looking for where a function, class, component, or type is defined or referenced. Only fall back to file-level search when graphify doesn't have coverage (e.g., env vars, config values, non-code assets).

## Architecture

### Route Groups

The `app/` directory uses three Next.js route groups:

- **`(auth)`** — login, register, guest auth, better-auth API catch-all. Guest users get auto-created accounts with `guest-{timestamp}` emails.
- **`(chat)`** — main chat UI and API routes (`/api/chat`, `/api/document`, `/api/files/upload`, `/api/history`, `/api/messages`, `/api/models`, `/api/suggestions`, `/api/vote`, `/api/chat/[id]/stream`, `/api/chat/[id]/pin`, `/api/projects`, `/api/projects/[projectId]/chats`, `/api/projects/[projectId]/files`).
- **`(settings)`** — user settings page.

### Auth (`lib/auth.ts`, `lib/auth-client.ts`)

Uses **better-auth** with drizzle-adapter (not NextAuth). Plugins: `organization()`, `sso()`, `nextCookies()`. Auth catch-all route at `app/(auth)/api/[[...all]]/route.ts`. The `auth()` helper in `lib/auth.ts` returns `{ user: { id, email, name, type } } | null`.

### AI Layer (`lib/ai/`)

- **`models.ts`** — defines available chat models and provider routing via `gatewayOrder`. Default model: `moonshotai/kimi-k2.5`.
- **`providers.ts`** — returns the Vercel AI Gateway language model in production, or a mock `customProvider` in test environments (`PLAYWRIGHT_TEST_BASE_URL`, `PLAYWRIGHT`, or `CI_PLAYWRIGHT` env vars).
- **`entitlements.ts`** — rate limits per user type (guest/regular: 10 messages/hour).
- **`prompts.ts`** — system prompts including artifact usage instructions. Tools are only enabled when the model supports them (`supportsTools` flag).
- **`tools/`** — AI tool definitions using AI SDK `tool()` with Zod schemas.
- **`vector-store.ts`** — OpenAI vector store operations (create, upload, search, list) and AI SDK tool factories (`createSearchProjectFilesTool`, `createListProjectFilesTool`, `createGetFileContentTool`) for RAG over project files.

### Projects & Vector Store

Projects group chats and files together. Each project gets an OpenAI vector store for RAG:

- **DB tables**: `Project` (name, description, vectorStoreId, fileCount), `ProjectFile` (openaiFileId, vectorStoreFileId, status), `McpServer` (user-configured MCP connections).
- **API**: `/api/projects` (CRUD), `/api/projects/[projectId]/chats` (list chats in project), `/api/projects/[projectId]/files` (upload/list/delete files).
- Files are uploaded to OpenAI Files API, then added to the project's vector store. The LLM autonomously calls search/list/content tools during chat when a project is active.
- Chat pinning: `isPinned` boolean on `Chat` table, `/api/chat/[id]/pin` endpoint.

### Database (`lib/db/`)

- **`schema.ts`** — Drizzle ORM schema in the `chatbot` pgSchema (not public). Tables: `Chat`, `Message_v2`, `Vote_v2`, `Document` (versioned via composite PK of `id` + `createdAt`), `Suggestion`, `Stream`, `Project`, `ProjectFile`, `McpServer`, plus better-auth tables (`user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `ssoProvider`).
- **`queries/`** — database operations split by domain.
- **`migrate.ts`** — migration runner.

### Artifacts System

Artifacts are documents/code/spreadsheets that appear in a side panel during chat. The system has two layers:

- **`lib/artifacts/server.ts`** — `createDocumentHandler` factory and `documentHandlersByArtifactKind` registry. Each handler implements `onCreateDocument` and `onUpdateDocument`.
- **`artifacts/`** — per-kind implementations (`code/`, `text/`, `sheet/`, `image/`) with separate `client.tsx` and `server.ts` files. Client exports an `artifactDefinition` with kind, content component, and stream handlers.
- **`components/chat/artifact.tsx`** — the `Artifact` component that renders the side panel, manages document versioning, and coordinates with `artifactDefinitions`.

### Client-Side State

- **`hooks/use-artifact.ts`** — artifact state via SWR (not React state). The `useArtifact()` hook and `useArtifactSelector()` are the primary interfaces.
- **`hooks/use-active-chat.tsx`** — central chat state provider wrapping `useChat` from `@ai-sdk/react`.
- **`components/chat/data-stream-handler.tsx`** — processes incoming data stream events and updates artifact state.
- **`components/chat/data-stream-provider.tsx`** — React context for data stream state.

### Error Handling

`lib/errors.ts` defines a typed `ChatbotError` class with error codes in `type:surface` format (e.g., `rate_limit:chat`, `unauthorized:auth`). Each surface has a visibility setting controlling whether errors are returned to the client or logged server-side.

### Key Conventions

- Path alias: `@/*` maps to project root (`tsconfig.json` paths).
- Package manager: `pnpm` (v10.32.1, enforced via `packageManager` field).
- Linting: Biome via ultracite. Several directories are excluded from linting: `components/ai-elements`, `components/elements`, `components/ui`, `lib/utils.ts`, `hooks/use-mobile.ts`.
- React Compiler is enabled (`reactCompiler: true` in `next.config.ts`).
- DB schema uses the `chatbot` pgSchema, not the default public schema.
- Resumable streaming: when `REDIS_URL` is set, the chat stream is wrapped with `resumable-stream` for connection resilience.
- OpenAI API key required for vector store / RAG features (`OPENAI_API_KEY`).

### Environment Variables

Required (see `.env.example`):
- `AUTH_SECRET` — better-auth secret
- `AI_GATEWAY_API_KEY` — needed for non-Vercel deployments (Vercel uses OIDC)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` — AWS S3 for file uploads
- `POSTGRES_URL` — Neon/PostgreSQL connection string

Optional:
- `REDIS_URL` — enables IP rate limiting and resumable streams
- `OPENAI_API_KEY` — enables vector store / RAG features for projects
- `IS_DEMO=1` — enables demo mode with `/demo` basePath
- `PLAYWRIGHT=1` / `PLAYWRIGHT_TEST_BASE_URL` / `CI_PLAYWRIGHT` — enables test environment (mock models)
