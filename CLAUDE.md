# Rebolt AI — Project Rules

## Specification

**SPEC.md is the single source of truth.** It contains the complete architecture, database schema, type definitions, service contracts, API routes, AI agent design, UI layout, and visual design system. Every file you write must match what SPEC.md specifies — do not improvise or deviate.

- Before implementing any file, read the relevant SPEC.md section first.
- If SPEC.md and this file conflict, SPEC.md wins (this file is a condensed reference).

### SPEC.md Section Map

| Section | Contents                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1–3     | Overview, tech stack, project structure                                                                                       |
| 4       | Database schema (Drizzle) — tables, relations, type exports                                                                   |
| 5       | All TypeScript types — Result, errors, API, AI, file, component props                                                         |
| 6       | Service layer — Result pattern, error mapping, route handler pattern                                                          |
| 7       | Auth — WorkOS proxy.ts, withAuthHandler, AuthKitProvider                                                                      |
| 8       | File upload — validation, parsing (Papa Parse, SheetJS), Vercel Blob                                                          |
| 9       | LLM agent — tools (analyzeData, generateArtifact), system prompts, multi-model routing, message persistence, title generation |
| 10      | Artifact system — Sandpack config, preview/code toggle, error feedback                                                        |
| 11      | Chat UI — layout, ChatPanel, MessageBubble (tool parts), MessageInput                                                         |
| 12      | File structure — complete file tree                                                                                           |
| 13      | Visual design system — typography, colors, component styling, spacing                                                         |
| 14–20   | Data flow, SOLID principles, env vars, implementation order, testing                                                          |

## Stack

- Next.js 16.2.0, React 19.2.4, TypeScript 5, Tailwind CSS v4
- Drizzle ORM + PlanetScale Postgres (pooled connection URL)
- WorkOS AuthKit (`@workos-inc/authkit-nextjs@latest`)
- AI SDK: `ai@latest`, `@ai-sdk/openai@latest`, `@ai-sdk/react@latest`
- Sandpack (`@codesandbox/sandpack-react@latest`) for artifact rendering
- Vercel Blob for raw file storage
- Zod for runtime validation, UUIDv7 for IDs

## Architecture Rules

### Layers

- `src/types/` — All shared types. Never inline complex types. All interfaces use `readonly`.
- `src/services/` — Business logic. Every function returns `Result<T, E>`. Never returns HTTP Response.
- `src/lib/` — Utilities (auth HOF, prompt builders). Thin glue between layers.
- `src/app/api/` — Route handlers. Map `Result` to `Response` via `errorResponse()`. All wrapped in `withAuthHandler()`.
- `src/components/` — React components. Receive minimal props (ISP). No business logic.
- `src/hooks/` — Client-side state. `useChat` wrapper, error capture, SWR queries.
- `src/db/` — Schema + client. Drizzle ORM only.

### Error Handling (Errors as Values)

- Recoverable errors → `Result<T, E>` from services. Discriminated union: `{ ok: true, value }` | `{ ok: false, error }`.
- Unrecoverable errors → throw (DB down, network). Caught by error boundaries / Next.js 500.
- `errorResponse(error: AppError)` maps domain errors to HTTP status at the API boundary.
- AppError union: `AuthError | ValidationError | NotFoundError | ConflictError | FileError`.

### Auth Pattern

- `proxy.ts` (NOT middleware.ts) — Next.js 16 uses proxy. Having both = error E900.
- `withAuthHandler()` HOF wraps every route. Calls `withAuth({ ensureSignedIn: true })`, upserts user atomically with `onConflictDoNothing`.
- `<AuthKitProvider initialAuth={auth}>` in root layout. Exclude `accessToken` from client bundle.

### AI SDK v6 Patterns (Critical — Do NOT use outdated APIs)

- `streamText` for chat (not `generateText`). With `tools` and `stopWhen: stepCountIs(3)` (NOT `maxSteps`).
- `toUIMessageStreamResponse()` (not `toDataStreamResponse()`).
- `maxOutputTokens` (not `maxTokens`).
- Server route must `await convertToModelMessages(messages)` — `UIMessage[]` has `parts`, NOT `content`.
- Only validate `conversationId` with zod (`chatBodySchema`); messages are unvalidated `UIMessage[]`.
- `tool()` with `inputSchema` (not `parameters`).
- `generateText` inside tool `execute()` for multi-model routing.
- `useChat` returns `status` (`'ready' | 'submitted' | 'streaming' | 'error'`), NOT `isLoading`.
- `useChat` with manual `useState` for input (managed input removed).
- `DefaultChatTransport` from `'ai'` for transport config.
- `generateText` + `Output.object()` for structured output (not `generateObject`).
- `UIMessage` has NO `content` — only `parts`. Import `UIMessage` from `'ai'`.
- Tool parts: `part.type` is `'tool-{name}'` (e.g., `'tool-generateArtifact'`), NOT `'tool-invocation'`.
- Tool states: `'input-streaming' | 'input-available' | 'output-available' | 'output-error'` — NOT `'partial-call' | 'call' | 'result'`.
- Tool output on `part.output`, NOT `part.result`.
- Model IDs in `AI_MODELS` constant (`types/ai.ts`), never hardcoded.

### Drizzle ORM Patterns

- `uuid` column + `$defaultFn(() => uuidv7())` for all PKs (except users — WorkOS text ID).
- `timestamp('...', { withTimezone: true })` for ALL time columns.
- `index()` on every FK column — Postgres does NOT auto-create these.
- `$type<T>()` for typed JSONB. `$inferSelect` / `$inferInsert` for type exports.
- `onConflictDoNothing()` for atomic upserts. Transactions for multi-step writes.

### Performance Rules

- `Promise.all()` for independent DB queries.
- Suspense boundaries for RSC streaming.
- `next/dynamic({ ssr: false })` for Sandpack (~2MB).
- Direct imports from Shadcn files (no barrel imports).
- Derive state during render (useMemo), not in useEffect.

### Design Tokens

- Fonts: Inter (font-sans, body/UI), Geist Mono (font-mono, code). Brand wordmark uses SVG from `/public/branding/`.
- Light theme only. Pure white bg, near-black text, Rebolt brand blue accent (#006AFE).
- User messages: `bg-primary/10`. Assistant: plain text, no bubble.
- Shadcn defaults. No custom components. Minimal shadows (`shadow-sm` on focused input only).
- Border radius: `rounded-md` buttons, `rounded-lg` cards, `rounded-xl` input, `rounded-2xl` bubbles.

### Prompt Logging

- After every development prompt, append to `prompts.jsonl` (JSON Lines format).
- Schema: `{ timestamp, "tool/model": "Claude", purpose, prompt, notes }`.
