# SPEC: Rebolt — Chat with CSV/Excel + Interactive Artifacts

## 1. Overview

<!-- source: src/app/page.tsx, src/app/chat/layout.tsx, src/components/chat/chat-view.tsx, src/app/api/chat/route.ts -->

An authenticated spreadsheet chat application that lets users upload CSV/XLS/XLSX files, ask questions about them, and receive AI-generated interactive artifacts rendered live in the browser. Conversations are persisted per user, uploads are stored as both original blobs and normalized dataset envelopes, and generated artifacts are compiled inside Sandpack as multi-file React projects. The current implementation also includes file preview, artifact ZIP export, full-dataset inspection tools, background artifact validation, and an automatic artifact retry loop for runtime/tool failures.

---

## 2. Tech Stack

<!-- source: package.json, src/app/layout.tsx, src/lib/chat/create-chat-ui-stream.ts, src/services/uploads.ts -->

| Layer              | Technology                                                    | Purpose                                                                           |
| ------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Framework          | Next.js 16.2.0 + React 19.2.4 + TypeScript                    | App Router application shell, server components, route handlers, client UI        |
| Auth               | WorkOS AuthKit (`@workos-inc/authkit-nextjs`)                 | Session handling, auth redirects, authenticated user access                       |
| AI Runtime         | Vercel AI SDK 6 (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`)     | Streaming chat, tool execution, typed UI messages, model validation               |
| AI Models          | `gpt-4.1`, `gpt-5.4-mini`, `gpt-5.4-nano`                     | Chat orchestration, artifact code generation, titles, structured dataset analysis |
| Database           | PostgreSQL + `pg`                                             | Persistent storage for users, conversations, messages, and uploaded-file metadata |
| ORM / Migrations   | Drizzle ORM + drizzle-kit                                     | Type-safe schema, queries, and SQL migrations                                     |
| File Storage       | Vercel Blob                                                   | Original file storage and normalized dataset-envelope storage                     |
| File Parsing       | Papa Parse + SheetJS (`xlsx`)                                 | CSV/XLS/XLSX parsing and first-sheet preview generation                           |
| Artifact Runtime   | `@codesandbox/sandpack-react`                                 | In-browser compilation/rendering of generated React artifacts                     |
| Artifact Export    | JSZip + generated Vite scaffold                               | Downloading artifact source as a standalone ZIP project                           |
| UI / Styling       | Tailwind CSS v4 + custom components + Lucide + Base UI Dialog | Application styling, icons, and modal primitives                                  |
| Markdown Rendering | `react-markdown` + `remark-gfm` + `rehype-sanitize`           | Safe assistant markdown rendering with code blocks and tables                     |

---

## 3. Architecture

<!-- source: src/proxy.ts, src/app/chat/layout.tsx, src/components/chat/chat-view.tsx, src/app/api/chat/route.ts, src/actions/conversations.ts -->

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Next.js 16 App Router                            │
│                                                                             │
│  ┌────────────────────┐   ┌──────────────────────────────────────────────┐ │
│  │ Public Landing Page │   │ Authenticated Chat Workspace                │ │
│  │ /                   │   │ /chat, /chat/[conversationId]               │ │
│  │ "Get started" CTA   │   │                                              │ │
│  └────────────────────┘   │  ┌──────────────┐  ┌──────────────────────┐ │ │
│                           │  │ Sidebar       │  │ ChatView             │ │ │
│  proxy.ts                 │  │ Conversations │  │ Messages + Composer  │ │ │
│  - / -> /chat when signed │  │ Delete / New  │  │ File preview dialog  │ │ │
│  - /chat* -> WorkOS auth  │  │ User card     │  │ Optional artifact pane│ │ │
│                           │  └──────────────┘  └──────────────────────┘ │ │
│                           └──────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Interfaces                                                            │  │
│  │  API routes:                                                          │  │
│  │   POST /api/chat                                                      │  │
│  │   POST /api/upload                                                    │  │
│  │   GET  /api/files/[fileId]/preview                                    │  │
│  │                                                                       │  │
│  │  Server actions:                                                      │  │
│  │   createConversation / createConversationOnly / removeConversation    │  │
│  │   signOutAction                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────┐   ┌────────────────────────────────────┐  │
│  │ PostgreSQL                  │   │ Vercel Blob                        │  │
│  │ users                       │   │ original uploads                   │  │
│  │ conversations               │   │ datasets/<fileId>.json             │  │
│  │ messages (content + parts)  │   │                                    │  │
│  │ files (metadata + sample)   │   │                                    │  │
│  └─────────────────────────────┘   └────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Browser artifact runtime                                              │  │
│  │  SandpackProvider -> Preview / Code view                              │  │
│  │  Hidden dataset helper (/src/rebolt-dataset.ts)                       │  │
│  │  Background validator + runtime bridge + retry orchestration          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema (Drizzle ORM)

<!-- source: src/db/schema.ts, drizzle/0000_nosy_cobalt_man.sql, drizzle/0001_hot_skrulls.sql -->

```typescript
// src/db/schema.ts
import { pgTable, text, timestamp, integer, jsonb, uuid, varchar, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { AppUIMessage } from '@/types/ai';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New Chat'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('conversations_user_id_idx').on(table.userId)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    uiMessageId: text('ui_message_id').notNull(),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    parts: jsonb('parts').$type<AppUIMessage['parts']>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    uniqueIndex('messages_ui_message_id_idx').on(table.uiMessageId),
  ],
);

export const files = pgTable(
  'files',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(),
    fileSize: integer('file_size').notNull(),
    blobUrl: text('blob_url').notNull(),
    columnNames: jsonb('column_names').$type<string[]>().notNull(),
    rowCount: integer('row_count').notNull(),
    sampleData: jsonb('sample_data').$type<Record<string, unknown>[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('files_user_id_idx').on(table.userId), index('files_conversation_id_idx').on(table.conversationId)],
);
```

**Notes from the current implementation:**

| Concern             | Current behavior                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Message persistence | `messages.content` stores extracted text, while `messages.parts` stores the full AI SDK UI message parts for replay/rendering.                                                                             |
| Dataset storage     | There is no dataset table. Full normalized datasets are stored as JSON blobs under `datasets/<fileId>.json`.                                                                                               |
| Migration drift     | `src/db/schema.ts` marks `files.blobUrl` as required, but `drizzle/0001_hot_skrulls.sql` drops the `NOT NULL` constraint. Fresh migrations therefore allow null even though the app writes it as required. |

### Drizzle Config

<!-- source: drizzle.config.ts -->

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### Database Client

<!-- source: src/db/client.ts -->

```typescript
// src/db/client.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });
```

---

## 5. Types & Interfaces

<!-- source: src/types/*.ts -->

All shared type definitions live in `src/types/`. The current codebase relies heavily on typed AI SDK message parts, typed retry payloads, and JSONB-backed DTOs instead of plain text-only chat records.

### Result Type (Errors as Values)

<!-- source: src/types/result.ts -->

```typescript
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

### Domain Errors

<!-- source: src/types/errors.ts -->

```typescript
export type AppError = AuthError | ValidationError | NotFoundError | ConflictError | FileError;

export interface NotFoundError {
  readonly type: 'NOT_FOUND';
  readonly resource: string;
  readonly id: string;
}

export interface FileError {
  readonly type: 'FILE_ERROR';
  readonly message: string;
  readonly code: 'INVALID_TYPE' | 'TOO_LARGE' | 'PARSE_FAILED' | 'TOO_MANY_ROWS' | 'TOO_MANY_COLUMNS';
}

export function errorResponse(error: AppError): Response {
  const statusMap = {
    AUTH_ERROR: 401,
    VALIDATION_ERROR: 400,
    NOT_FOUND: 404,
    CONFLICT: 409,
    FILE_ERROR: 422,
  };

  const message = error.type === 'NOT_FOUND' ? `${error.resource} not found: ${error.id}` : error.message;
  return Response.json({ error: error.type, message }, { status: statusMap[error.type] });
}
```

### API Request & Response Types

<!-- source: src/types/api.ts -->

```typescript
export const chatBodySchema = z.object({
  conversationId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        id: z.string().min(1),
        role: z.enum(['user', 'assistant']),
        parts: z.array(z.unknown()),
        metadata: z.unknown().optional(),
      }),
    )
    .min(1),
  artifactRetry: z
    .object({
      assistantMessageId: z.string().min(1),
      artifactToolCallId: z.string().min(1),
      fileId: z.string().uuid().nullable(),
      artifactTitle: z.string().nullable(),
      artifactDescription: z.string().nullable(),
      files: z.record(z.string(), z.string()).nullable(),
      error: z.string().min(1),
      source: z.enum(ARTIFACT_RETRY_SOURCES),
      attempt: z.number().int().positive(),
      manual: z.boolean(),
    })
    .optional(),
});

export interface UploadResponse {
  readonly fileId: string;
  readonly fileName: string;
  readonly blobUrl: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly preview: readonly Record<string, unknown>[];
  readonly truncated: boolean;
}

export interface FilePreviewResponse {
  readonly fileId: string;
  readonly fileName: string;
  readonly summaryLabel: string;
  readonly note: string;
  readonly previewText: string;
  readonly truncated: boolean;
}
```

### AI Model Configuration

<!-- source: src/types/ai.ts -->

```typescript
export const AI_MODELS = {
  analysis: 'gpt-4.1',
  codegen: 'gpt-5.4-mini',
  title: 'gpt-5.4-nano',
} as const;

export interface AnalysisToolOutput {
  readonly summary: string;
  readonly insights: readonly string[];
  readonly suggestedApproach: string;
  readonly sampleValues: readonly Record<string, unknown>[];
}

export interface ArtifactToolOutput {
  readonly title: string;
  readonly fileId: string | null;
  readonly datasetUrl?: string | null;
  readonly files: Readonly<Record<string, string>>;
}
```

### Artifact State

<!-- source: src/types/chat.ts -->

```typescript
export const MAX_ARTIFACT_AUTO_RETRIES = 3;

export interface ArtifactRetryPayload {
  readonly assistantMessageId: string;
  readonly artifactToolCallId: string;
  readonly fileId: string | null;
  readonly artifactTitle: string | null;
  readonly artifactDescription: string | null;
  readonly files: Readonly<Record<string, string>> | null;
  readonly error: string;
  readonly source:
    | 'sandpack-runtime'
    | 'sandpack-notification'
    | 'sandpack-timeout'
    | 'tool-output-error'
    | 'request-error';
  readonly attempt: number;
  readonly manual: boolean;
}

export interface ActiveArtifact {
  readonly key: string;
  readonly assistantMessageId: string;
  readonly toolCallId: string;
  readonly fileId: string | null;
  readonly datasetUrl?: string | null;
  readonly title: string | null;
  readonly description: string | null;
  readonly files: Readonly<Record<string, string>>;
}
```

### File Types & Constants

<!-- source: src/types/file.ts -->

```typescript
export const FILE_LIMITS = {
  maxSizeBytes: 5 * 1024 * 1024,
  maxRows: 10_000,
  maxColumns: 150,
  sampleSize: 20,
} as const;

export const ALLOWED_FILE_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const;

export interface FileDataContext {
  readonly fileId: string;
  readonly fileName: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly sampleData: readonly Record<string, unknown>[];
  readonly datasetProfile: DatasetProfile;
  readonly datasetUrl: string;
}
```

`FILE_LIMITS.maxRows` exists in the shared type constants, but the current upload/parser path does not enforce it. `UploadResponse.truncated` is therefore always `false` in the current implementation.

### Component Prop Interfaces

<!-- source: src/types/components.ts -->

```typescript
export interface ArtifactPanelProps {
  readonly artifact: ActiveArtifact;
  readonly runtimeState: ArtifactRuntimeState;
  readonly isRetryDisabled: boolean;
  readonly onManualRetry: () => void;
  readonly onRuntimeEvent: (event: ArtifactRuntimeEvent) => void;
  readonly onClose: () => void;
}

export interface FileUploadBadgeProps {
  readonly fileName: string;
  readonly fileType: string;
}

export interface SidebarItemProps {
  readonly id: string;
  readonly title: string;
  readonly isActive: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
}
```

---

## 6. Error Handling (Errors as Values)

<!-- source: src/lib/api.ts, src/types/errors.ts, src/services/uploads.ts, src/services/conversations.ts -->

### Philosophy

Recoverable domain errors are modeled as typed `Result<T, E>` values in most service-layer code. Route handlers convert those into HTTP responses with `errorResponse()`. Client-side server actions are less strict: they often throw plain `Error` instances after calling service helpers.

```
Service Layer                 → Result<T, E>
Route Handler                 → errorResponse(result.error)
Server Action                 → throws Error on invalid flow
Sandpack / runtime feedback   → structured retry payloads
```

### Service Functions Return Results

<!-- source: src/services/conversations.ts, src/services/uploads.ts -->

| Service                     | Success value             | Failure value                |
| --------------------------- | ------------------------- | ---------------------------- |
| `getConversation()`         | `Conversation`            | `NotFoundError`              |
| `getOwnedFileRecord()`      | `FileRecord`              | `NotFoundError`              |
| `uploadConversationFile()`  | `UploadResponse`          | `NotFoundError \| FileError` |
| `listConversations()`       | `Conversation[]`          | never                        |
| `getConversationFileData()` | `FileDataContext \| null` | never                        |

### Route Handlers Map Results to Responses

<!-- source: src/app/api/chat/route.ts, src/app/api/upload/route.ts, src/app/api/files/[fileId]/preview/route.ts -->

`withAuthHandler()` injects `user` into each route handler by calling `getCurrentUser()`. Route handlers then validate request input and convert `Result` failures into HTTP responses through `errorResponse()`.

```typescript
export const POST = withAuthHandler(async (req, { user }) => {
  const parsedBody = await parseJsonBody(req, chatBodySchema);
  if (!parsedBody.success) {
    return errorResponse(parsedBody.error);
  }

  const conversation = await getConversation(parsedBody.data.conversationId, user.id);
  if (!conversation.ok) {
    return errorResponse(conversation.error);
  }
});
```

### File Upload Validation with Results

<!-- source: src/services/files.ts -->

```typescript
export function validateFile(file: File): Result<void, FileError> {
  if (!ALLOWED_FILE_TYPES.includes(file.type as AllowedFileType)) {
    return err({
      type: 'FILE_ERROR',
      message: `Invalid file type: ${file.type}. Allowed: CSV, XLSX.`,
      code: 'INVALID_TYPE',
    });
  }

  if (file.size > FILE_LIMITS.maxSizeBytes) {
    return err({ type: 'FILE_ERROR', message: `File too large: ...`, code: 'TOO_LARGE' });
  }

  return ok(undefined);
}
```

The parser also returns `FILE_ERROR` values for parse failures and column overflows. Empty rows are removed from parsed data before persistence and dataset-envelope generation.

### When Errors Still Throw

<!-- source: src/services/files.ts, src/lib/tools/create-generate-artifact-tool.ts, src/hooks/use-artifact-retry.ts -->

These flows still throw plain exceptions today:

| Location                                        | Example throw path                                       |
| ----------------------------------------------- | -------------------------------------------------------- |
| `buildFilePreview()`                            | Blob fetch fails or spreadsheet preview generation fails |
| `buildDatasetFromOriginalBlob()`                | Original blob fetch fails or reparse fails               |
| `createGenerateArtifactTool()`                  | Codegen output cannot be parsed/validated into files     |
| `createConversation()` / `removeConversation()` | Invalid state inside server actions                      |
| `createArtifactArchive()`                       | Dataset export or ZIP creation fails                     |

---

## 7. Authentication (WorkOS AuthKit)

<!-- source: src/proxy.ts, src/app/auth/callback/route.ts, src/app/layout.tsx, src/lib/auth.ts, src/actions/auth.ts -->

### Flow

1. `proxy.ts` calls `authkit(request)` for every non-static route.
2. Authenticated users visiting `/` are redirected to `/chat`.
3. Unauthenticated users visiting `/chat` or `/chat/[conversationId]` are redirected to WorkOS via `authorizationUrl`.
4. `/auth/callback` completes the WorkOS flow and returns the user to `/chat`.
5. `getCurrentUser()` calls `withAuth({ ensureSignedIn: true })`, then upserts the user record into Postgres.
6. `RootLayout` passes `initialAuth` into `AuthKitProvider` to avoid re-fetching auth state on hydration.
7. The sidebar sign-out control submits `signOutAction()`.

### Key Files

| File                             | Responsibility                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/proxy.ts`                   | Redirects authenticated `/` users into chat and unauthenticated `/chat*` users into WorkOS |
| `src/app/auth/callback/route.ts` | Handles the WorkOS callback                                                                |
| `src/app/layout.tsx`             | Creates `AuthKitProvider` with server-derived `initialAuth`                                |
| `src/lib/auth.ts`                | Loads the current user and ensures a DB row exists                                         |
| `src/actions/auth.ts`            | Server action for sign-out                                                                 |

### Environment Variables

<!-- source: src/proxy.ts, src/lib/auth.ts, .env.example -->

The repository does not directly reference any WorkOS env var names with `process.env.*`, but `.env.example` documents the AuthKit configuration expected by the app runtime:

```env
WORKOS_API_KEY=sk-...
WORKOS_CLIENT_ID=client_...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
WORKOS_COOKIE_PASSWORD=<32+ char random string>
```

Those values are consumed implicitly by the imported WorkOS AuthKit SDK rather than by local configuration code in this repository.

### Proxy Setup (Next.js 16)

<!-- source: src/proxy.ts -->

```typescript
export default async function proxy(request: NextRequest) {
  const { session, headers, authorizationUrl } = await authkit(request);
  const { pathname } = request.nextUrl;

  if (pathname === '/' && session.user) {
    return handleAuthkitHeaders(request, headers, { redirect: '/chat' });
  }

  if (pathname.startsWith('/chat') && !session.user && authorizationUrl) {
    return handleAuthkitHeaders(request, headers, { redirect: authorizationUrl });
  }

  return handleAuthkitHeaders(request, headers);
}
```

### AuthKitProvider with Optimized Initial Auth

<!-- source: src/app/layout.tsx -->

`RootLayout` server-renders auth state, strips `accessToken`, and provides the remaining shape to `AuthKitProvider initialAuth`.

### Authenticated Route Handler (SOLID: Single Responsibility + Open/Closed)

<!-- source: src/lib/api.ts, src/lib/auth.ts -->

`withAuthHandler()` is intentionally small. It does not own request validation, error mapping, or user synchronization logic itself; it only ensures the current user is available and passes it to the wrapped handler. User synchronization lives in `getCurrentUser()`.

---

## 8. File Upload & Ingestion

<!-- source: src/app/api/upload/route.ts, src/services/uploads.ts, src/services/files.ts, src/services/datasets.ts -->

### API Route: `POST /api/upload`

The upload route accepts `multipart/form-data` with:

| Field            | Type        | Notes                                                |
| ---------------- | ----------- | ---------------------------------------------------- |
| `conversationId` | UUID string | Must belong to the current user                      |
| `file`           | `File`      | First uploaded file from the picker/drop interaction |

### Storage Strategy

The current implementation stores uploaded data in three places:

| Layer                  | Stored value                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Vercel Blob            | Original file contents via `put(file.name, file, ...)`                                         |
| Vercel Blob            | Normalized dataset envelope JSON at `datasets/<fileId>.json`                                   |
| PostgreSQL `files` row | `fileName`, `fileType`, `fileSize`, `blobUrl`, `columnNames`, `rowCount`, first 20 sample rows |

There is no server-side file transformation pipeline beyond parsing plus dataset-envelope generation. The normalized dataset is generated immediately during upload.

### Upload Route (Services Return Results)

<!-- source: src/services/uploads.ts -->

```typescript
export async function uploadConversationFile({ conversationId, userId, file }) {
  const conversation = await getConversation(conversationId, userId);
  const validation = validateFile(file);
  const parsed = parseFileContents(Buffer.from(await file.arrayBuffer()), file.type);

  const [blob] = await Promise.all([
    put(file.name, file, { access: 'public', addRandomSuffix: true }),
    storeDatasetForUpload({ id: fileId, fileName: file.name, columnNames, rowCount }, parsed.rows),
  ]);

  // insert files row, touch conversation.updatedAt, return UploadResponse
}
```

What is actually enforced today:

| Rule                                       | Status                                  |
| ------------------------------------------ | --------------------------------------- |
| Allowed types                              | CSV, XLSX, XLS MIME types only          |
| Max size                                   | 5 MB                                    |
| Max columns                                | 150                                     |
| Max rows                                   | Not enforced in the current parser path |
| Sample rows stored in DB                   | 20                                      |
| Preview rows returned from upload response | 5                                       |

### Preview Route

<!-- source: src/app/api/files/[fileId]/preview/route.ts, src/services/files.ts -->

`GET /api/files/[fileId]/preview` verifies file ownership, fetches the original blob, and returns a preview excerpt:

| File type | Preview strategy                                                              |
| --------- | ----------------------------------------------------------------------------- |
| CSV       | Raw text excerpt, capped to 160 lines or 24 KB                                |
| XLS/XLSX  | Converts the first worksheet to CSV text, then applies the same excerpt logic |

The preview response includes a summary label, an explanatory note, preview text, and a `truncated` flag.

---

## 9. LLM Agent (Tool-Based Architecture)

<!-- source: src/app/api/chat/route.ts, src/lib/chat/create-chat-ui-stream.ts, src/lib/tools/*.ts, src/lib/system-prompt*.ts -->

### Multi-Model Routing via Tools

| Responsibility                   | Model          | Where it is used                                       |
| -------------------------------- | -------------- | ------------------------------------------------------ |
| Main streaming assistant         | `gpt-4.1`      | `streamText()` inside `createChatUIStream()`           |
| Artifact code generation         | `gpt-5.4-mini` | `generateText()` inside `createGenerateArtifactTool()` |
| Title generation                 | `gpt-5.4-nano` | `generateTitle()`                                      |
| Structured full-dataset analysis | `gpt-5.4-nano` | `createAnalyzeDataTool()`                              |

### Multi-Step Tool Chain

The assistant currently has three tools:

| Tool               | Purpose                                                               |
| ------------------ | --------------------------------------------------------------------- |
| `analyzeData`      | Inspect full dataset structure/profile and produce summary + insights |
| `readDatasetRows`  | Read exact rows from the normalized full dataset with safety caps     |
| `generateArtifact` | Produce a multi-file React artifact and inject the dataset helper     |

The main agent is configured with `stopWhen: stepCountIs(5)`, not `3`.

### API Route: `POST /api/chat`

<!-- source: src/app/api/chat/route.ts -->

Current request handling:

1. Parse and validate `conversationId`, `messages`, and optional `artifactRetry`.
2. Fetch conversation ownership and file context in parallel.
3. Build tool definitions for the current file context.
4. Validate incoming UI messages with `safeValidateUIMessages()`.
5. Persist the current message list via `syncConversationMessages()`.
6. Convert UI messages to model messages, optionally appending a retry-specific synthetic user message.
7. Stream a typed UI message response with `createChatUIStream()`.

### System Prompts (Analysis + Codegen)

<!-- source: src/lib/system-prompt.ts, src/lib/system-prompt-data.ts, src/lib/system-prompt-sections.ts -->

The implementation currently builds two prompts: one for the main assistant and one for the code generator.

## Available Data

For the analysis prompt, the assistant receives:

- file name
- column names
- total row count
- stored sample-row count
- a profile per column (`inferredType`, missing/invalid/distinct counts, min/max, sample values, top values)
- the first 20 sampled rows, with the first 20 also excerpted as preview JSON

When no file is attached, the prompt explicitly says `No file has been uploaded yet.`

## Your Role

The current analysis prompt instructs the assistant to:

1. analyze the user's question
2. call `analyzeData` when schema understanding matters
3. call `readDatasetRows` when exact rows matter
4. call `generateArtifact` when an interactive UI would help
5. summarize what was created after artifact generation

## Tool Chain Strategy

The analysis prompt distinguishes between:

- text-only answers for simple metadata questions
- direct `generateArtifact` for clear artifact requests
- `analyzeData` first for exploratory or ambiguous requests
- `readDatasetRows` for exact-row-sensitive requests

## Description Quality

The assistant is told to keep `generateArtifact.description` focused on:

- what to show
- why it matters
- which columns to use
- only the interactions/layout constraints the user explicitly asked for

## Error Correction

Retries are prompt-driven. When an artifact fails, the retry message includes:

- the latest user request text
- file/schema summary
- previous artifact title/description/files
- retry attempt number
- retry source
- exact error text

The assistant is explicitly told to keep the original user goal intact and call `generateArtifact` again unless artifact generation is impossible.

## Available Data

For the codegen prompt, the model receives:

- file name
- columns
- total rows
- stored sample rows
- full dataset profile
- sampled row JSON

## Output Format

The codegen prompt requires a single JSON object with a `files` field. Keys must be file paths under `/src/`, and values must be raw file contents. The parser still supports a single fenced TSX/JSX fallback, but the prompt does not encourage that fallback.

## Project Constraints

The codegen model is currently constrained to:

- include `/src/App.tsx` with a default export
- use only `/src/*` files
- load the full dataset through `./rebolt-dataset` when a file is attached
- use the pinned runtime package set: `react`, `react-dom`, `recharts`, `lucide-react`
- rely on Tailwind CSS via CDN
- keep chart widths responsive and table layouts horizontally scrollable

## Design

The codegen prompt asks for polished, minimal UIs and explicitly discourages unnecessary filters or controls. It also requires loading/error states around runtime dataset loading.

### Message Persistence

<!-- source: src/services/messages.ts -->

`syncConversationMessages()` persists the current chat transcript by `ui_message_id`, updates any changed `role`/`content`/`parts`, deletes rows that are no longer present in the current transcript, and always touches `conversations.updatedAt`.

### Auto-Title Generation

<!-- source: src/actions/conversations.ts, src/services/ai.ts -->

`createConversation()` generates the first user message row and a title in parallel. If title generation succeeds, the conversation title is updated from the default `"New Chat"` to the model output.

---

## 10. Artifact System (Sandpack)

<!-- source: src/components/artifact/*.tsx, src/hooks/use-artifact*.ts, src/lib/artifact/*.ts, src/lib/tools/dataset-runtime-helper.ts -->

### How It Works

Artifacts are represented as multi-file React projects, not a single component string. A successful `tool-generateArtifact` output becomes an `ActiveArtifact` with:

- `assistantMessageId`
- `toolCallId`
- `fileId`
- optional `datasetUrl`
- title + description
- generated file map

The UI always treats the latest successful artifact as the active one.

### Sandpack Configuration (Lazy-Loaded)

<!-- source: src/components/artifact/artifact-panel.tsx, src/components/artifact/artifact-sandpack-host.tsx -->

The artifact runtime is lazy-loaded through `next/dynamic()` and then mounted through `SandpackProvider` with:

```typescript
template: 'react-ts'
files: {
  ...generatedFiles,
  '/index.tsx': hidden entry file,
  '/src/rebolt-dataset.ts': hidden when dataset-backed
}
customSetup: {
  dependencies: {
    react: '19.2.4',
    'react-dom': '19.2.4',
    recharts: '3.8.0',
    'lucide-react': '0.577.0',
    'react-is': '17.0.2',
  }
}
options: {
  activeFile: '/src/App.tsx',
  externalResources: ['https://cdn.tailwindcss.com'],
  initMode: 'immediate',
  autorun: true,
}
```

### Error Feedback Loop

<!-- source: src/hooks/use-artifact.ts, src/hooks/use-artifact-retry.ts, src/components/artifact/artifact-sandpack-runtime-bridge.tsx -->

The current retry loop works like this:

1. A new artifact appears in the message stream.
2. If it is new and not historical, `useArtifact()` starts validation.
3. A hidden off-screen Sandpack instance (`ArtifactBackgroundValidator`) compiles/renders the artifact.
4. Runtime events are emitted as:
   - `ready`
   - `runtime-error`
   - `notification-error`
   - `timeout`
5. `useArtifactRetry()` converts those events into structured retry payloads.
6. Automatic retries call `regenerate()` with `artifactRetry` in the request body.
7. Automatic retries stop after `MAX_ARTIFACT_AUTO_RETRIES = 3`.
8. Manual retry remains available from the footer after failure/exhaustion.

Dataset-access failures are treated specially: if the runtime error starts with `[rebolt-dataset]`, the UI surfaces the failure but does not auto-retry.

### Source Export

<!-- source: src/lib/artifact/artifact-export.ts, src/lib/artifact/artifact-export-scaffold.ts -->

The artifact panel includes a ZIP export button. Exported archives contain:

- the generated source files
- a Vite scaffold (`index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `package.json`)
- a generated README
- `public/rebolt-dataset.json` when the artifact depends on uploaded data

During export, the hidden dataset helper is rewritten to point at `/rebolt-dataset.json` instead of the remote blob URL.

### Why Sandpack?

The implementation clearly favors Sandpack because the artifact system needs all of the following inside the browser:

- TypeScript + React compilation
- a preview surface and code explorer in the same UI
- access to runtime/compile errors
- support for multi-file outputs and npm dependencies

That makes Sandpack a better fit than a plain iframe or Web Worker for this codebase. Server-side sandboxes are also not used anywhere in the implementation; artifact execution stays fully client-side.

---

## 11. Chat UI (Frontend)

<!-- source: src/components/chat/*.tsx, src/hooks/*.ts, src/components/message/*.tsx -->

### Layout: Sidebar + Conversation + Optional Artifact Pane

The current layout is not a permanent three-panel shell. The chat workspace always renders:

- a collapsible sidebar on the left
- the conversation pane in the center
- an artifact pane on the right only when the user opens it and an active artifact exists

### Chat Layout (Server Rendered)

<!-- source: src/app/chat/layout.tsx -->

`src/app/chat/layout.tsx` is a server component. It:

- loads the current user
- loads the full conversation list
- maps them into `ConversationSummary` objects
- renders the sidebar around the route content

There are loading components for `/chat` and `/chat/[conversationId]`, but no Suspense boundary orchestration in the current layout.

### Conversation Page Hydration

<!-- source: src/app/chat/page.tsx, src/app/chat/[conversationId]/page.tsx, src/services/conversations.ts -->

`/chat` renders an empty `ChatView`. `/chat/[conversationId]` server-loads `ConversationDetailResponse` and passes persisted `messages.parts` into the client.

### Client-Side Chat Hook (AI SDK `useChat`)

<!-- source: src/hooks/use-app-chat.ts -->

```typescript
const chat = useChat<AppUIMessage>({
  id: conversationId ?? '__pending__',
  messages: initialMessages,
  transport: new DefaultChatTransport({
    api: '/api/chat',
    body: { conversationId: effectiveId },
  }),
});
```

`useAppChat()` keeps the text input local and builds outgoing user messages with both text parts and uploaded-file data parts.

### Chat Panel — Typed Tool Parts (No Regex)

<!-- source: src/lib/message/message-bubble-parts.ts, src/components/message/assistant-message-part.tsx -->

Message rendering is based on typed AI SDK parts, not regex parsing:

- `text`
- `reasoning`
- `data-agent-activity`
- `data-uploaded-file`
- `tool-analyzeData`
- `tool-readDatasetRows`
- `tool-generateArtifact`

The UI filters tool parts so only the last state per tool call is shown, and it suppresses generic step activity once more specific progress exists.

### MessageBubble — Renders Text + Tool Parts

<!-- source: src/components/message/message-bubble.tsx, src/components/message/tool-invocation-part.tsx -->

User messages render:

- uploaded-file chips
- a tinted user bubble with plain text parts

Assistant messages render:

- markdown text
- reasoning lines
- running step/tool activity
- collapsible analysis and dataset-inspection sections
- collapsible “Instructions sent to code generator” for successful artifact outputs
- artifact cards that open the artifact pane

If an assistant message creates an artifact but contains no visible natural-language text, the UI synthesizes a fallback sentence such as `I created <title>.`

---

## 12. File Structure

<!-- source: find output + file inspection -->

```text
.
├── drizzle.config.ts
├── drizzle/
│   ├── 0000_nosy_cobalt_man.sql
│   └── 0001_hot_skrulls.sql
├── src/
│   ├── actions/
│   │   ├── auth.ts
│   │   └── conversations.ts
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts
│   │   │   ├── files/[fileId]/preview/route.ts
│   │   │   └── upload/route.ts
│   │   ├── auth/callback/route.ts
│   │   ├── chat/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── [conversationId]/page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── artifact/        # panel, Sandpack host, runtime bridge, export button
│   │   ├── chat/            # ChatView, composer, file preview, layout panes
│   │   ├── message/         # assistant/user message rendering + markdown
│   │   └── sidebar/         # conversation list, user card
│   ├── db/
│   │   ├── client.ts
│   │   └── schema.ts
│   ├── hooks/
│   │   ├── use-app-chat.ts
│   │   ├── use-conversation.ts
│   │   ├── use-file-upload.ts
│   │   ├── use-file-preview.ts
│   │   ├── use-artifact.ts
│   │   └── use-artifact-retry.ts
│   ├── lib/
│   │   ├── artifact/        # artifact selection, retry payloads, ZIP export
│   │   ├── chat/            # model-message conversion + stream wiring
│   │   ├── datasets/        # envelope building, caching, blob storage
│   │   ├── tools/           # analyze/read/codegen tools + dataset helper injection
│   │   ├── system-prompt.ts
│   │   ├── system-prompt-data.ts
│   │   ├── system-prompt-sections.ts
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── artifact-runtime.ts
│   ├── services/
│   │   ├── ai.ts
│   │   ├── conversations.ts
│   │   ├── datasets.ts
│   │   ├── files.ts
│   │   ├── messages.ts
│   │   └── uploads.ts
│   ├── types/
│   │   ├── ai.ts
│   │   ├── api.ts
│   │   ├── chat.ts
│   │   ├── errors.ts
│   │   ├── file.ts
│   │   └── result.ts
│   └── proxy.ts
└── package.json
```

---

## 13. Visual Design System

<!-- source: src/app/page.tsx, src/app/layout.tsx, src/components/chat/*.tsx, src/components/artifact/*.tsx -->

### Design Philosophy

The current UI is restrained and border-driven. Most surfaces are white or token-based neutrals, with strong emphasis on whitespace, rounded corners, and a single bright blue accent for actions. The landing page is separate from the authenticated workspace and uses the same brand assets as the sidebar.

### Typography

<!-- source: src/app/layout.tsx, src/components/message/markdown-renderer.tsx -->

| Usage                | Implementation                                   |
| -------------------- | ------------------------------------------------ |
| Primary sans serif   | Inter via `next/font/google`                     |
| Monospace            | Geist Mono via `geist/font/mono`                 |
| Empty-state heading  | `text-3xl font-bold`                             |
| Landing-page heading | `text-4xl font-bold tracking-tight`              |
| Body copy / messages | `text-sm` to `text-[15px]` depending on renderer |
| Code                 | Geist Mono in code blocks and file previews      |

### Color Palette

Only a few literal colors are hardcoded in TSX; most surfaces rely on semantic design tokens (`background`, `foreground`, `muted`, `border`, `primary`):

| Color / token                        | Where it appears                                                |
| ------------------------------------ | --------------------------------------------------------------- |
| `#006AFE`                            | Submit button active fill; primary accent throughout the app    |
| `#0D0E10`                            | Landing CTA fill and inactive submit button fill                |
| `bg-primary/[0.07]` + `#1e3a5f` text | User message bubble                                             |
| `bg-muted`, `bg-muted/30`, `border`  | Sidebar rows, artifact panel header/footer, file chips, dialogs |

### Component Styling

| Component           | Current treatment                                                                     |
| ------------------- | ------------------------------------------------------------------------------------- |
| Sidebar             | 260px expanded / 60px collapsed, border-right, list-style conversation rows           |
| Composer            | Rounded 2xl bordered surface with attach button, growing textarea, icon submit button |
| User bubble         | Right-aligned, rounded 2xl with subtle primary tint                                   |
| Artifact card       | Bordered rounded tile with icon, title, and status text                               |
| Artifact panel      | Border-left panel with preview/code toggle pills and close button                     |
| File preview dialog | Large centered modal with blurred backdrop and bordered preview surface               |

### Spacing & Layout

| Area                        | Current rule                                  |
| --------------------------- | --------------------------------------------- |
| Chat message column         | `max-w-3xl` centered                          |
| Empty-state vertical offset | `pt-[20vh]`                                   |
| Artifact pane width         | Defaults to 50vw, minimum 300px, maximum 70vw |
| File preview dialog         | `min(760px, calc(100vw - 2rem))`              |

### States

| State                       | Visual Treatment                                           |
| --------------------------- | ---------------------------------------------------------- |
| Empty conversation          | Centered heading plus composer                             |
| Upload in progress          | Attach button shows spinner                                |
| Chat generating             | `Thinking...` row when no assistant content is visible yet |
| Artifact validating         | Footer text `Validating artifact...`                       |
| Artifact self-correcting    | Footer text `Self-correcting...` plus last error           |
| Artifact failed / exhausted | Destructive footer text and `Try again` button             |
| File preview loading        | Spinner in modal body                                      |

---

## 14. API Routes Detail

<!-- source: src/app/api/*.ts, src/actions/*.ts -->

The current codebase exposes **three** API routes. Conversation creation/deletion is handled through server actions, not through `/api/conversations` routes.

### `POST /api/chat`

Validates `conversationId`, `messages`, and optional `artifactRetry` against `chatBodySchema`. Loads conversation ownership and file context in parallel. Validates incoming UI messages with `safeValidateUIMessages()`, persists the current transcript, converts the transcript to model messages, appends a synthetic retry message when needed, and streams a typed `UIMessageStream` response.

### `POST /api/upload`

Validates `FormData` with zod (`conversationId`, `file`). Enforces file type/size, parses CSV/XLS/XLSX, stores the original upload and normalized dataset envelope in Vercel Blob, inserts a `files` row in Postgres, touches `conversations.updatedAt`, and returns `UploadResponse`.

### `GET /api/files/[fileId]/preview`

Validates the `fileId` route param, verifies ownership, fetches the original file blob, then returns a CSV-style excerpt with summary metadata and truncation information. Spreadsheet previews are generated from the first worksheet only.

### Conversation Mutations (Server Actions)

<!-- source: src/actions/conversations.ts -->

| Action                     | What it does                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `createConversation()`     | Creates or reuses a conversation, inserts the first user message, and attempts title generation |
| `createConversationOnly()` | Creates a blank conversation so uploads can happen before the first prompt                      |
| `removeConversation()`     | Deletes the conversation DB row after ownership validation, then revalidates `/chat`            |

Deleting a conversation currently removes database rows via cascades, but it does **not** delete the already-uploaded blob objects.

---

## 15. Environment Variables

<!-- source: drizzle.config.ts, src/db/client.ts, .env.example -->

```env
# WorkOS AuthKit (.env.example)
WORKOS_API_KEY=sk-...
WORKOS_CLIENT_ID=client_...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
WORKOS_COOKIE_PASSWORD=<32+ char random string>

# Database
DATABASE_URL=postgresql://...

# Vercel Blob (.env.example)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# OpenAI (.env.example)
OPENAI_API_KEY=sk-...
```

`DATABASE_URL` is the only variable read directly by repository source. The other entries are documented by `.env.example` and are required by the integrated WorkOS AuthKit, Vercel Blob, and OpenAI SDKs at runtime. The example template labels the database as “PlanetScale Postgres — use pooled connection URL”, but the app code itself only requires a PostgreSQL-compatible connection string.

---

## 16. Data Flow Walkthrough

<!-- source: src/app/page.tsx, src/actions/conversations.ts, src/app/api/upload/route.ts, src/app/api/chat/route.ts, src/hooks/use-artifact-retry.ts -->

### Happy Path: User uploads a spreadsheet and asks for an artifact

```
1. User opens / and clicks "Get started"
2. proxy.ts sends unauthenticated /chat traffic into WorkOS
3. After callback, /chat renders ChatView inside authenticated ChatLayout
4. User uploads CSV/XLS/XLSX
   - createConversationOnly() may run first if no conversation exists yet
   - POST /api/upload validates + parses file
   - original file -> Vercel Blob
   - normalized dataset envelope -> Vercel Blob (datasets/<fileId>.json)
   - metadata + sample rows -> files table
5. User sends the first prompt
   - createConversation() inserts the first user message and starts title generation
   - useAutoReply() immediately calls regenerate() because the latest message is user-authored
6. POST /api/chat loads conversation + latest file context, validates UI messages, syncs them to DB
7. gpt-4.1 streams steps/tool calls
   - may call analyzeData
   - may call readDatasetRows
   - calls generateArtifact
8. gpt-5.4-mini returns multi-file artifact JSON
9. Dataset helper is injected into /src/rebolt-dataset.ts
10. Assistant message persists with full parts JSONB
11. UI renders:
    - markdown summary
    - collapsible analysis/dataset inspection
    - artifact card
12. Hidden Sandpack validator compiles the artifact
13. User opens the artifact panel to view Preview or Code
14. User can download the artifact as a ZIP Vite project
```

### Error Path: Generated artifact fails

```
1. Artifact generation fails inside the tool
   OR
   Sandpack reports a runtime/notification/timeout failure
2. useArtifactRetry() converts the failure into a structured artifactRetry payload
3. regenerate({ messageId, body: { conversationId, artifactRetry } }) replays the failed assistant turn
4. buildArtifactRetryMessage() appends:
   - original user request
   - schema summary
   - previous artifact title/description/files
   - exact error text
   - attempt/source metadata
5. The main assistant is instructed to call generateArtifact again with corrected instructions
6. Up to 3 automatic retries are attempted
7. If retries are exhausted, the artifact footer exposes a manual "Try again" action
8. Dataset-access failures are surfaced immediately and not auto-retried
```

---

## 17. Sandpack Tradeoffs (for README)

<!-- source: src/components/artifact/*.tsx, src/lib/artifact-runtime.ts -->

### Why Sandpack over alternatives?

**What the current implementation gets from Sandpack:**

- client-side React + TypeScript compilation
- multi-file project support
- built-in preview, file explorer, and code editor surfaces
- runtime/compile notifications that can be converted into retry events
- support for the exact runtime dependency set the code generator is allowed to use

**Tradeoffs visible from the implementation:**

- execution is limited to browser-compatible JavaScript/React artifacts
- the artifact pane carries a heavier client bundle than a plain iframe
- runtime validation depends on hidden/off-screen Sandpack instances for background checks
- full dataset access is implemented through a fetched helper file, not direct filesystem/API access

**Alternatives not used here:**

- plain iframes would still need a custom bundling/build pipeline for multi-file React output
- Web Workers cannot render DOM-based React UIs directly
- server-side sandboxes are absent from the code; this app deliberately keeps artifact execution local to the browser

---

## 19. Key Implementation Notes

<!-- source: src/lib/chat/*.ts, src/lib/tools/*.ts, src/lib/datasets/*.ts, src/hooks/*.ts -->

### AI SDK v6 Patterns

- `createUIMessageStreamResponse()` is used in the chat route.
- `createUIMessageStream()` is used to merge `streamText()` output into the response stream.
- Incoming chat payloads are validated with `safeValidateUIMessages()`.
- Model messages are built from stored UI messages with `convertToModelMessages()`.
- `DefaultChatTransport` drives client-side requests.
- Tool progress is surfaced as typed `data-agent-activity` parts, not ad-hoc text.

### Drizzle ORM Patterns

- UUIDv7 IDs are used for all application-owned primary keys.
- Message rows store both plain extracted text and full JSONB parts.
- Foreign-key indexes are created explicitly.
- Conversation `updatedAt` is manually touched during message sync and file upload.

### WorkOS AuthKit Patterns (Next.js 16)

- Route protection uses `proxy.ts`, not `middleware.ts`.
- Callback handling is delegated to `handleAuth({ returnPathname: '/chat' })`.
- Auth hydration is optimized with `AuthKitProvider initialAuth`.

### Dataset + File Patterns

- Full datasets are materialized as normalized JSON envelopes.
- Original file blobs are still kept for preview/backfill.
- Dataset envelopes are cached in memory for 5 minutes by `fileId`.
- Small datasets can be fully read by the `readDatasetRows` tool; large ones are sliced.

### Artifact Runtime & Export

- Every dataset-backed artifact gets a hidden `/src/rebolt-dataset.ts`.
- The preview panel and the code viewer are two views over the same Sandpack project.
- Exports become standalone Vite projects with an optional local dataset snapshot.

### Error Handling

- Tool failures and runtime failures both feed the same retry pipeline.
- Retry payloads include source labels (`sandpack-runtime`, `tool-output-error`, etc.).
- Dataset fetch errors are prefixed with `[rebolt-dataset]` so they can bypass auto-retry.

### Typing Discipline

- Shared DTOs live in `src/types/`.
- Persisted messages use AI SDK UI-message types rather than a custom chat shape.
- File preview, upload, and conversation responses are strongly typed end-to-end.

### Database (PostgreSQL)

- The repo is configured for PostgreSQL through `DATABASE_URL`.
- There is no seed script and no DB bootstrap automation beyond Drizzle migrations.
- The migration history and Drizzle schema currently disagree on `files.blob_url` nullability.

---

## 20. Implementation Order

<!-- source: dependency flow inferred from current files -->

```
Phase 1 — Core platform
  1. Next.js app shell, landing page, WorkOS proxy/callback, root auth provider
  2. PostgreSQL + Drizzle schema/client + migration files

Phase 2 — Conversation lifecycle
  3. Conversation services + server actions
  4. Sidebar, route loading/error states, persisted message replay

Phase 3 — Upload + dataset normalization
  5. File validation/parsing
  6. Original upload storage + dataset-envelope storage
  7. File preview route + dialog

Phase 4 — Streaming AI orchestration
  8. Chat route + typed UI-message validation
  9. Full-dataset tools (analyze/read/codegen)
  10. Prompt builders + title generation

Phase 5 — Artifact runtime
  11. Active artifact selection + Sandpack host
  12. Background validation + runtime bridge
  13. Retry orchestration + manual retry footer

Phase 6 — Export + polish
  14. ZIP export scaffold with local dataset snapshot
  15. Live tool-activity stream, markdown rendering, file chips, preview/code toggle
```
