---
CODEBASE AUDIT REPORT — Rebolt AI
---

1. HARD REQUIREMENTS CHECK

1.1 Data Ingestion

- ✅ PASS — REST API endpoint at src/app/api/upload/route.ts:11-33 handles file uploads via POST with formData.
- ✅ PASS — Server-side file type validation in src/services/files.ts:27-44. Accepts CSV, XLSX, XLS (text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel). Defined in
  src/types/file.ts:62-66.
- ✅ PASS — 5MB file size limit enforced server-side at src/services/files.ts:36-42 (FILE_LIMITS.maxSizeBytes). Also limits: 10K rows, 150 columns defined in src/types/file.ts:55-60.
- ✅ PASS — Files stored in Vercel Blob (src/services/uploads.ts:54-55). A dataset envelope (full parsed JSON) is also uploaded to Blob (src/services/datasets.ts:15-24). DB record stores metadata + sampleData
  (src/services/uploads.ts:67-81). Agent accesses data via loadDatasetEnvelope() which reads from Blob with in-memory 5-min TTL cache (src/lib/datasets/dataset-cache.ts).
- ✅ PASS — Full lifecycle: upload → Zod validation (src/app/api/upload/route.ts:6-9) → validateFile() (type + size) → parseFileContents() (Papa Parse / SheetJS) → Blob storage + DB record → dataset envelope in Blob → agent
  retrieval via loadDatasetEnvelope() → injected into Sandpack via runtime helper.

  1.2 LLM Agent

- ✅ PASS — Agent generates TypeScript/React code via generateArtifact tool (src/lib/tools/create-generate-artifact-tool.ts:42-47) using generateText with a codegen-specific model.
- ✅ PASS — Error feedback loop implemented. Flow: Sandpack runtime errors captured → useArtifactErrors (src/hooks/use-artifact-errors.ts) → handleRuntimeEvent in useArtifactRetry (src/hooks/use-artifact-retry.ts:172-218) →
  requestRetry() calls regenerate() with artifactRetry payload → server receives retry context in chatBodySchema.artifactRetry → buildArtifactRetryMessage() constructs retry prompt with error details → new code generated. Also
  handles tool-output errors via useArtifactToolErrorRetry.
- ✅ PASS — Max 3 auto-retries (MAX_ARTIFACT_AUTO_RETRIES = 3 at src/types/chat.ts:6). After exhaustion, manual retry still available. Guard at src/hooks/use-artifact-retry.ts:94.
- ✅ PASS — Uses OpenAI models. AI_MODELS at src/types/ai.ts:3-7: gpt-4.1 (analysis), gpt-5.4-mini (codegen), gpt-5.4-nano (title generation). All via @ai-sdk/openai.
- ✅ PASS — Response streamed via createUIMessageStream + streamText at src/lib/chat/create-chat-ui-stream.ts:37-104. Uses createUIMessageStreamResponse() at src/app/api/chat/route.ts:56.

  1.3 Chat UI

- ✅ PASS — Multi-conversation support: create (src/actions/conversations.ts:22-59, createConversationOnly line 61), switch (sidebar navigation src/components/sidebar/sidebar.tsx), delete (removeConversation line 67).
- ✅ PASS — Conversations persisted in Postgres. Messages synced on every chat request via syncConversationMessages (src/services/messages.ts:35-68). On refresh, loaded from DB via getConversationDetail().
- ✅ PASS — Sandpack used for artifact rendering (@codesandbox/sandpack-react). Multiple artifact components: artifact-panel.tsx, artifact-sandpack.tsx, artifact-sandpack-code-pane.tsx, artifact-sandpack-preview-pane.tsx.
- ✅ PASS — Sandpack provides iframe-based sandbox isolation. Runtime errors monitored via artifact-sandpack-runtime-bridge.tsx.
- ✅ PASS — User can see both code (code pane) and rendered output (preview pane) — toggled via ArtifactPanelView: 'preview' | 'code' (src/types/components.ts:3).

  1.4 Tech Stack Compliance

- ✅ PASS — Next.js 16.2.0 (package.json)
- ✅ PASS — Vercel-compatible. Uses Vercel Blob, no filesystem writes, env vars documented.
- ✅ PASS — Shadcn components (shadcn in package.json, components.json present, src/components/ui/button.tsx, input.tsx)
- ✅ PASS — PostgreSQL via Drizzle ORM + pg driver. Schema defined in src/db/schema.ts. Migrations in drizzle/.
- ✅ PASS — Tailwind CSS v4 throughout. No mixed styling.
- ✅ PASS — 100% TypeScript. Zero .js/.jsx files. Zero as any, @ts-ignore, @ts-expect-error.
- ✅ PASS — OpenAI SDK via @ai-sdk/openai (package.json + all tool files).

---

2. CODE QUALITY AUDIT

2.1 SOLID Principles

- ✅ PASS — SRP: Clean layer separation. Services return Result<T, E>. Routes map to Response. Components receive minimal props. Tools split into individual files (create-analyze-data-tool.ts, create-generate-artifact-tool.ts,
  create-read-dataset-rows-tool.ts).
- ✅ PASS — OCP: New tools can be added by creating a new create-\*-tool.ts and registering in createChatTools(). File types defined as a constant array. Model IDs in AI_MODELS constant.
- ✅ PASS — LSP: No broken abstractions found. Result<T, E> used consistently.
- ✅ PASS — ISP: Component props are minimal (e.g., ArtifactPanelProps, FileUploadBadgeProps, SidebarItemProps in src/types/components.ts).
- ✅ PASS — DI: LLM provider abstracted via AI_MODELS constants. Model specified at call site via openai(AI_MODELS.xxx). Swappable.

  2.2 TypeScript Quality

- ✅ PASS — Zero any, as any, @ts-ignore, @ts-expect-error in entire src/.
- ✅ PASS — API inputs validated with Zod: chatBodySchema (src/types/api.ts:5-31), uploadFormSchema (src/app/api/upload/route.ts:6-9), createConversationBodySchema.
- ✅ PASS — DB types shared via $inferSelect/$inferInsert exports (src/db/schema.ts:109-116). JSONB columns typed with $type<T>().
- ✅ PASS — All interfaces use readonly throughout (src/types/\*.ts).

  2.3 React Quality

- ⚠️ PARTIAL — useEffect usage: useAutoScroll (src/hooks/use-auto-scroll.ts:10-16) only triggers on messages.length changes, not on streaming content updates within the last message. This means auto-scroll won't trigger during
  streaming — only when a new message is added. The scrollSignal parameter mitigates this somewhat.
- ✅ PASS — Loading/error/empty states: ChatViewEmptyState for no conversations, loading.tsx files for Suspense, error.tsx for chat errors, global-error.tsx for app-level, error-boundary.tsx shared component.
- ✅ PASS — No prop drilling issues. Hooks encapsulate state. Props are minimal.
- ✅ PASS — List keys are stable: convo.id in sidebar (src/components/sidebar/sidebar.tsx:134), message.id for messages.
- ✅ PASS — useArtifactErrors properly unsubscribes (src/hooks/use-artifact-errors.ts:19). useArtifactToolErrorRetry uses cleanup (src/hooks/use-artifact-tool-error-retry.ts:36-38).

  2.4 Error Handling

- ✅ PASS — Both API routes wrapped in withAuthHandler with proper status codes via errorResponse() (src/types/errors.ts:31-43). Status map: AUTH=401, VALIDATION=400, NOT_FOUND=404, CONFLICT=409, FILE=422.
- ✅ PASS — Errors as values: Result<T, E> pattern throughout services. Discriminated union.
- ✅ PASS — Upload failure: returns FileError or NotFoundError. LLM 429/500: caught by onError callback in createUIMessageStream. DB connection: connection pool with 5s timeout (src/db/client.ts:11). Artifact runtime error:
  captured, retried up to 3 times, then "exhausted" state shown.
- ✅ PASS — No swallowed errors. catch blocks in src/actions/conversations.ts:60 re-throw as error strings. generateTitle catch returns null gracefully (line 50).

  2.5 API Design

- ✅ PASS — Routes: POST /api/chat (chat), POST /api/upload (file upload). Both RESTful.
- ✅ PASS — Input validation on every endpoint via Zod schemas.
- ✅ PASS — Both endpoints wrapped in withAuthHandler which calls withAuth({ ensureSignedIn: true }).
- ✅ PASS — Consistent error shape: { error: string, message: string } via errorResponse().

---

3. SECURITY & EDGE CASES

- ✅ PASS — Zero eval(), new Function(), or dangerouslySetInnerHTML in entire codebase.
- ⚠️ PARTIAL — File validation is extension/MIME-based only (file.type check). No magic byte validation. However, files are parsed through Papa Parse / SheetJS which would reject non-CSV/Excel content.
- ✅ PASS — Sandpack provides iframe-based sandbox. Generated code runs in a sandboxed iframe, isolated from the parent window.
- ✅ PASS — No API keys in client code. OPENAI_API_KEY only used server-side (files marked 'server-only'). .env in .gitignore.
- ✅ PASS — Drizzle ORM parameterizes all queries. No raw SQL construction.
- ❌ FAIL — No rate limiting on chat or upload endpoints. No middleware or external rate limiter configured.

---

4. STREAMING & UX

- ✅ PASS — LLM response streamed via createUIMessageStream → createUIMessageStreamResponse(). Protocol: standard ReadableStream with UI message chunks.
- ⚠️ PARTIAL — The artifact code is NOT streamed in real-time during generation. generateArtifact uses generateText (not streamText) for code generation (src/lib/tools/create-generate-artifact-tool.ts:42). The code appears only
  after the full codegen response completes. However, activity progress indicators are shown during the process ("Starting codegen" → "Codegen finished" → "Parsing files" → etc.).
- ✅ PASS — Loading/thinking indicator via live agent activity system (useLiveAgentActivity → step/tool activities shown). Status-based: 'submitted' | 'streaming' mapped to isLoading.
- ✅ PASS — User can't send while loading: input disabled when isLoading || conversation.isPending (src/components/chat/chat-view.tsx:153).
- ⚠️ PARTIAL — Auto-scroll triggers on messages.length change only, not during streaming content. User manual scroll-up is implicitly respected (no forced scroll during streaming), but there's no explicit "user scrolled up"
  detection to pause auto-scroll.

---

5. DATABASE & PERSISTENCE

- ✅ PASS — Drizzle ORM with pg (node-postgres) driver. Pool config at src/db/client.ts.
- ✅ PASS — Schema: users, conversations, messages, files. Relations defined. Migrations in drizzle/.
- ✅ PASS — Cascading deletes on all FKs: conversations.userId → cascade, messages.conversationId → cascade, files.userId → cascade, files.conversationId → cascade (src/db/schema.ts).
- ✅ PASS — FK indexes defined: conversations_user_id_idx, messages_conversation_id_idx, files_user_id_idx, files_conversation_id_idx, messages_ui_message_id_idx (unique). Schema lines 28, 47-50, 75.
- ✅ PASS — UUIDv7 for PKs via $defaultFn(() => uuidv7()) on conversations, messages, files. Users use WorkOS text ID (correct per spec).
- ✅ PASS — timestamp('...', { withTimezone: true }) on all time columns.
- ✅ PASS — Conversations, messages, artifacts (as message parts), and file metadata all persisted.
- ✅ PASS — No N+1 patterns. Promise.all() used for parallel queries (src/services/conversations.ts:77, src/app/api/chat/route.ts:25).

---

6. DEPLOYMENT READINESS

- ✅ PASS — package.json has correct scripts: dev, build, start, lint.
- ✅ PASS — .env.example documents all 4 required env var groups: WorkOS (4 vars), DATABASE_URL, BLOB_READ_WRITE_TOKEN, OPENAI_API_KEY.
- 🔍 NOTE — Build not tested in this audit (would require all env vars + DB connection).
- ✅ PASS — Zero hardcoded localhost URLs in src/. Only in .env.example for local development redirect URI.
- ✅ PASS — DB connection string via process.env.DATABASE_URL (src/db/client.ts:8).

---

PRIORITY FIXES

┌─────┬──────────┬─────────────────────┬───────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ # │ Severity │ Item │ Location │ Action │
├─────┼──────────┼─────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1 │ HIGH │ No rate limiting │ /api/chat, /api/upload │ Add rate limiting middleware (e.g., @upstash/ratelimit or Vercel Edge config). Without this, the OpenAI API key is exposed to abuse │
│ │ │ │ │ via rapid requests. │
├─────┼──────────┼─────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2 │ MEDIUM │ Artifact code not │ src/lib/tools/create-generate-artifact-tool.ts:42 │ generateText is used for codegen, meaning the user sees nothing until the full response is generated. Consider using streamText for │
│ │ │ streamed │ │ the codegen step to show code as it's written, or keep current approach if activity indicators are sufficient. │
├─────┼──────────┼─────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3 │ LOW │ Auto-scroll during │ src/hooks/use-auto-scroll.ts │ Scroll only triggers on messages.length change, not during token streaming within a message. Consider adding a scroll trigger on │
│ │ │ streaming │ │ content length or last-message update. │
├─────┼──────────┼─────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 4 │ LOW │ No magic byte │ src/services/files.ts:28 │ File validation relies on MIME type only. A malicious user could upload a non-CSV/Excel file with a spoofed MIME type. Mitigated by │
│ │ │ validation │ │ parsing (Papa Parse/SheetJS will reject), but magic byte check adds defense-in-depth. │
├─────┼──────────┼─────────────────────┼───────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 5 │ LOW │ In-memory dataset │ src/lib/datasets/dataset-cache.ts │ Map-based in-memory cache won't survive serverless cold starts and doesn't share across instances. Fine for single-instance dev, but │
│ │ │ cache │ │ in production Vercel serverless, cache misses will be frequent. Consider external cache if performance becomes an issue. │
└─────┴──────────┴─────────────────────┴───────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

---

Overall assessment: This is a well-architected codebase that closely follows the SPEC.md. The layer separation (types → services → lib → API → components → hooks) is clean. The Result pattern, typed errors, Zod validation, and
server-only markers are applied consistently. The artifact retry loop is sophisticated and complete. The only critical gap is rate limiting

All 4 audit agents have completed. The audit report above already incorporates my direct file reads. Let me refine it with the additional findings from the sub-agents:

---

## ADDENDUM — Findings from Deep Audit Agents

### Additional Data Ingestion Findings

**⚠️ PARTIAL — `maxRows` limit not enforced during parsing** (`src/services/files.ts:47-78`). The `FILE_LIMITS.maxRows = 10_000` constant exists but `parseFileContents()` never checks it. A file with 50K rows will be fully parsed into memory. The `truncated` field is always `false` (line 70).

**⚠️ PARTIAL — No transaction rollback for multi-step upload** (`src/services/uploads.ts:54-65`). The original file blob upload and dataset envelope upload happen in `Promise.all()`. If the envelope upload fails but the blob succeeds, the DB record will reference a missing dataset. No retry or rollback logic exists.

### Additional List Key Finding

**🔍 NOTE — Index-based keys in message parts** — 4 locations:

- `src/components/message/user-message-bubble.tsx:31` — `key={index}` for parts
- `src/components/message/assistant-message-bubble.tsx:32` — index fallback in key
- `src/components/message/assistant-message-bubble.tsx:42` — index fallback in key
- `src/components/message/tool-invocation-part.tsx:37` — `key={index}` for insights

These are low risk since message parts don't reorder, but not ideal.

---

## REVISED PRIORITY FIXES

| #   | Severity   | Item                         | Location                                            | Action                                                                                                           |
| --- | ---------- | ---------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | **HIGH**   | No rate limiting             | `/api/chat`, `/api/upload`                          | Add rate limiting (e.g., `@upstash/ratelimit`). OpenAI API key exposed to abuse.                                 |
| 2   | **MEDIUM** | `maxRows` not enforced       | `src/services/files.ts:47-78`                       | Add `if (rows.length > FILE_LIMITS.maxRows)` check in `parseFileContents()` and truncate with `truncated: true`. |
| 3   | **MEDIUM** | Artifact code not streamed   | `src/lib/tools/create-generate-artifact-tool.ts:42` | `generateText` means user sees nothing during codegen. Activity indicators mitigate this partially.              |
| 4   | **LOW**    | Upload not atomic            | `src/services/uploads.ts:54-65`                     | Wrap blob + envelope + DB writes in error handling with rollback/cleanup.                                        |
| 5   | **LOW**    | Auto-scroll during streaming | `src/hooks/use-auto-scroll.ts`                      | Only triggers on `messages.length`, not during token streaming.                                                  |
| 6   | **LOW**    | In-memory dataset cache      | `src/lib/datasets/dataset-cache.ts`                 | `Map` won't survive serverless cold starts. Fine for dev, consider external cache for prod scale.                |
| 7   | **LOW**    | Index-based list keys        | 4 message component files                           | Replace `key={index}` with stable identifiers.                                                                   |
| 8   | **LOW**    | No magic byte validation     | `src/services/files.ts:28`                          | MIME-only check. Mitigated by parser rejection of invalid content.                                               |
