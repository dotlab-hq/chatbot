# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chatbot is a full-stack AI chat application built with Next.js 16 App Router, React 19, and the Vercel AI SDK v6. It uses the Vercel AI Gateway for multi-provider LLM access, Drizzle ORM with PostgreSQL for persistence, and NextAuth v5 for authentication.

## Commands

- `pnpm dev` — start dev server (Turbo mode)
- `pnpm build` — runs DB migration then `next build`
- `pnpm check` / `pnpm fix` — lint/fix via Biome (ultracite wrapper)
- `pnpm test` — Playwright E2E tests (requires `PLAYWRIGHT=True` env)
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:push` — Drizzle Kit schema management
- `pnpm db:studio` — Drizzle Kit visual DB editor

Tests are in `tests/e2e/` and use Playwright with Desktop Chrome. The test suite starts the dev server automatically. Tests use mock models (see `lib/ai/models.mock.ts` and `tests/prompts/utils.ts`).

## Architecture

### Route Groups

The `app/` directory uses two Next.js route groups:

- **`(auth)`** — login, register, guest auth, NextAuth API routes. Auth is NextAuth v5 (Credentials provider for email/password and anonymous guests).
- **`(chat)`** — main chat UI and all API routes (`/api/chat`, `/api/document`, `/api/files/upload`, `/api/history`, `/api/messages`, `/api/models`, `/api/suggestions`, `/api/vote`, `/api/chat/[id]/stream`).

### AI Layer (`lib/ai/`)

- **`models.ts`** — defines available chat models (DeepSeek V3.2, Kimi K2.5, GPT OSS 20B/120B, Grok 4.1 Fast) and their provider routing via `gatewayOrder`. Default model: `moonshotai/kimi-k2.5`.
- **`providers.ts`** — returns the Vercel AI Gateway language model in production, or a mock `customProvider` in test environments (`PLAYWRIGHT_TEST_BASE_URL`, `PLAYWRIGHT`, or `CI_PLAYWRIGHT` env vars).
- **`entitlements.ts`** — rate limits per user type (guest/regular: 10 messages/hour).
- **`prompts.ts`** — system prompts including artifact usage instructions. Tools are only enabled when the model supports them (`supportsTools` flag).
- **`tools/`** — five AI tool definitions: `getWeather`, `createDocument`, `editDocument`, `updateDocument`, `requestSuggestions`. These use the AI SDK `tool()` function with Zod schemas.

### Database (`lib/db/`)

- **`schema.ts`** — Drizzle ORM schema with tables: `User`, `Chat`, `Message_v2`, `Vote_v2`, `Document` (versioned via composite PK of `id` + `createdAt`), `Suggestion`, `Stream`.
- **`queries.ts`** — all database operations (server-only via `import "server-only"`). Uses `postgres` driver with `drizzle-orm/postgres-js`.
- **`migrate.ts`** — migration runner invoked during build.

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
- Middleware/Auth: NextAuth basePath is hardcoded to `/api/auth`. Guest users get auto-created accounts with `guest-{timestamp}` emails.
- Resumable streaming: when `REDIS_URL` is set, the chat stream is wrapped with `resumable-stream` for connection resilience.

### Environment Variables

Required (see `.env.example`):
- `AUTH_SECRET` — NextAuth secret
- `AI_GATEWAY_API_KEY` — needed for non-Vercel deployments (Vercel uses OIDC)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` — AWS S3 for file uploads
- `POSTGRES_URL` — Neon/PostgreSQL connection string
- `REDIS_URL` — optional, enables IP rate limiting and resumable streams

Optional:
- `IS_DEMO=1` — enables demo mode with `/demo` basePath
- `PLAYWRIGHT=1` / `PLAYWRIGHT_TEST_BASE_URL` / `CI_PLAYWRIGHT` — enables test environment (mock models)
