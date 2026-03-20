# SPEC: Chat with CSV/Excel — Artifacts MVP

## 1. Overview

An MVP chatbot that allows authenticated users to upload CSV/Excel files, ask questions about the data, and receive AI-generated interactive artifacts rendered live in the browser. Artifacts are general-purpose React components — charts, dashboards, data tables, trackers, calendars, forms, or any combination that best represents the data. The system supports multiple conversations per user, an error self-correction loop for generated code, and a three-panel layout inspired by Anthropic's Claude Artifacts.

---

## 2. Tech Stack

| Layer            | Technology                                                                   | Purpose                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 16.2.0 (App Router, TypeScript)                                      | Full-stack framework with RSC + API routes                                                                                  |
| Auth             | WorkOS AuthKit (`@workos-inc/authkit-nextjs@latest`)                         | Google OAuth, session management                                                                                            |
| AI               | Vercel AI SDK (`ai@latest`, `@ai-sdk/openai@latest`, `@ai-sdk/react@latest`) | Multi-model multi-step: `gpt-4.1-mini` (analysis + tool chain), `gpt-5.3-codex` (artifact codegen), `gpt-5.4-nano` (titles) |
| Database         | PostgreSQL (PlanetScale)                                                     | Persistent storage                                                                                                          |
| ORM              | Drizzle ORM (`drizzle-orm@latest`) + `drizzle-kit@latest`                    | Type-safe queries, migrations                                                                                               |
| UI               | Shadcn/ui + Tailwind CSS v4                                                  | Component library + styling                                                                                                 |
| File Storage     | Vercel Blob (`@vercel/blob@latest`)                                          | Raw file storage (CSV/XLSX originals)                                                                                       |
| Artifact Sandbox | `@codesandbox/sandpack-react@latest`                                         | Browser-based TypeScript/React execution                                                                                    |
| Charts           | Recharts (`recharts@latest`)                                                 | Chart rendering (available inside artifacts, not required)                                                                  |
| File Parsing     | Papa Parse (`papaparse@latest`), SheetJS (`xlsx@latest`)                     | Server-side file parsing                                                                                                    |
| Validation       | Zod (`zod@latest`)                                                           | Runtime input validation on API routes                                                                                      |
| IDs              | UUIDv7 (`uuidv7@latest`)                                                     | Time-ordered, index-friendly unique IDs                                                                                     |
| Deployment       | Vercel                                                                       | Hosting, serverless functions, edge                                                                                         |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Next.js 16 App Router                          │
│                                                                     │
│  ┌──────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
│  │ Sidebar   │   │  Chat Panel      │   │  Artifact Panel        │  │
│  │           │   │                  │   │  (lazy-loaded)         │  │
│  │ Convos    │   │  Messages        │   │  Sandpack              │  │
│  │ New Chat  │   │  Input + Upload  │   │  (React components)     │  │
│  │           │   │                  │   │  Error Display         │  │
│  └──────────┘   └──────────────────┘   └────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    API Layer (Route Handlers)                 │   │
│  │  All routes wrapped in withAuthHandler() HOF                 │   │
│  │  Services return Result<T, E> — errors as values             │   │
│  │  POST /api/chat          — AI streaming endpoint             │   │
│  │  POST /api/upload        — File upload + parse + Blob store  │   │
│  │  GET  /api/conversations — List user conversations           │   │
│  │  POST /api/conversations — Create new conversation           │   │
│  │  GET  /api/conversations/[id] — Get conversation + msgs      │   │
│  │  DELETE /api/conversations/[id] — Delete conversation        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  Database (PlanetScale)  │  │  Vercel Blob                    │  │
│  │  users | conversations  │  │  Raw CSV/XLSX files              │  │
│  │  messages | files       │  │                                  │  │
│  └─────────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema (Drizzle ORM)

```typescript
// db/schema.ts
import { pgTable, text, timestamp, integer, jsonb, uuid, varchar, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

// ─── Users ───
export const users = pgTable('users', {
  id: text('id').primaryKey(), // WorkOS user ID (external, kept as text)
  email: varchar('email', { length: 255 }).notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Conversations ───
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
  (table) => ({
    userIdIdx: index('conversations_user_id_idx').on(table.userId),
  }),
);

// ─── Messages ───
export const messages = pgTable(
  'messages',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationIdIdx: index('messages_conversation_id_idx').on(table.conversationId),
  }),
);

// ─── Files ───
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
  (table) => ({
    userIdIdx: index('files_user_id_idx').on(table.userId),
    conversationIdIdx: index('files_conversation_id_idx').on(table.conversationId),
  }),
);

// ─── Relations ───
export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  files: many(files),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
  files: many(files),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  user: one(users, { fields: [files.userId], references: [users.id] }),
  conversation: one(conversations, {
    fields: [files.conversationId],
    references: [conversations.id],
  }),
}));

// ─── Type Exports (DB entities) ───
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type FileRecord = typeof files.$inferSelect;
export type NewFileRecord = typeof files.$inferInsert;
```

### Drizzle Config

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### Database Client

```typescript
// db/client.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// PlanetScale Postgres — use pooled connection URL
// PgBouncer handles server-side pooling
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

All shared type definitions live in `types/`. Interfaces are separated by domain to satisfy **Interface Segregation** — consumers import only what they need.

### Result Type (Errors as Values)

```typescript
// types/result.ts

/** Discriminated union for recoverable operation outcomes. */
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

```typescript
// types/errors.ts
import type { Result } from './result';

/**
 * Discriminated union of all recoverable domain errors.
 * Infrastructure errors (DB down, network failure) still throw —
 * they are unrecoverable within business logic.
 */
export type AppError = AuthError | ValidationError | NotFoundError | ConflictError | FileError;

export interface AuthError {
  readonly type: 'AUTH_ERROR';
  readonly message: string;
}

export interface ValidationError {
  readonly type: 'VALIDATION_ERROR';
  readonly message: string;
  readonly fields?: Readonly<Record<string, string>>;
}

export interface NotFoundError {
  readonly type: 'NOT_FOUND';
  readonly resource: string;
  readonly id: string;
}

export interface ConflictError {
  readonly type: 'CONFLICT';
  readonly message: string;
}

export interface FileError {
  readonly type: 'FILE_ERROR';
  readonly message: string;
  readonly code: 'INVALID_TYPE' | 'TOO_LARGE' | 'PARSE_FAILED' | 'TOO_MANY_ROWS' | 'TOO_MANY_COLUMNS';
}

/** Maps a domain error to an HTTP Response at the API boundary. */
export function errorResponse(error: AppError): Response {
  const statusMap: Record<AppError['type'], number> = {
    AUTH_ERROR: 401,
    VALIDATION_ERROR: 400,
    NOT_FOUND: 404,
    CONFLICT: 409,
    FILE_ERROR: 422,
  };

  return Response.json({ error: error.type, message: error.message }, { status: statusMap[error.type] });
}
```

### API Request & Response Types

```typescript
// types/api.ts
import { z } from 'zod';

// ─── Chat ───
// Messages are UIMessage[] from the AI SDK — complex parts structure (no 'content' field).
// We only validate conversationId here; messages are validated by convertToModelMessages().
export const chatBodySchema = z.object({
  conversationId: z.string().uuid(),
});
export type ChatBody = z.infer<typeof chatBodySchema>;

// ─── Upload ───
export interface UploadResponse {
  readonly fileId: string;
  readonly fileName: string;
  readonly blobUrl: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly preview: readonly Record<string, unknown>[];
  readonly truncated: boolean;
}

// ─── Conversations ───
export interface ConversationSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface ConversationDetailResponse {
  readonly conversation: ConversationSummary;
  readonly messages: readonly MessageResponse[];
  readonly files: readonly FileMetadataResponse[];
}

export interface MessageResponse {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly createdAt: string;
}

export interface FileMetadataResponse {
  readonly id: string;
  readonly fileName: string;
  readonly fileType: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
}
```

### AI Model Configuration

```typescript
// types/ai.ts

/** Model routing — each task uses the optimal model for cost/quality. */
export const AI_MODELS = {
  /** Analysis + tool routing: cheap, fast, good at reasoning about data. */
  analysis: 'gpt-4.1-mini',
  /** Artifact code generation: best at producing correct TypeScript/React. */
  codegen: 'gpt-5.3-codex',
  /** Title generation: cheapest model, simple structured output. */
  title: 'gpt-5.4-nano',
} as const;

export type AIModelKey = keyof typeof AI_MODELS;

/** Output shape of the analyzeData tool. */
export interface AnalysisToolOutput {
  readonly summary: string;
  readonly insights: readonly string[];
  readonly suggestedApproach: string;
}

/** Output shape of the generateArtifact tool. */
export interface ArtifactToolOutput {
  readonly title: string;
  readonly code: string;
}

/** Zod input schema for the generateArtifact tool (mirrored as TS type). */
export interface ArtifactToolInput {
  readonly title: string;
  readonly description: string;
}
```

### Artifact State

```typescript
// types/chat.ts

export interface ArtifactState {
  readonly code: string | null;
  readonly error: string | null;
  readonly retryCount: number;
}

export const MAX_ARTIFACT_RETRIES = 3;
```

### File Types & Constants

```typescript
// types/file.ts

export type AllowedFileType =
  | 'text/csv'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel';

export interface ParsedFileData {
  readonly rows: readonly Record<string, unknown>[];
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly truncated: boolean;
}

export interface FileDataContext {
  readonly fileName: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly sampleData: readonly Record<string, unknown>[];
}

export const FILE_LIMITS = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  maxRows: 10_000,
  maxColumns: 50,
  sampleSize: 100,
} as const;

export const ALLOWED_FILE_TYPES: readonly AllowedFileType[] = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const;
```

### Component Prop Interfaces

Props are minimal — components only receive what they render (**Interface Segregation**):

```typescript
// types/components.ts

export interface ArtifactPanelProps {
  readonly title: string | null;
  readonly code: string | null;
  readonly error: string | null;
  readonly retryCount: number;
  readonly onFixError: () => void;
}

export interface FileUploadBadgeProps {
  readonly fileName: string;
  readonly rowCount: number;
  readonly onRemove: () => void;
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

### Philosophy

**Recoverable errors** (domain logic failures) are returned as typed `Result<T, E>` values. **Unrecoverable errors** (DB down, network failure) still throw exceptions — they're caught at the boundary (route handlers, error boundaries).

This follows the [domain-driven error pattern](https://github.com/Sairyss/domain-driven-hexagon?tab=readme-ov-file#domain-errors):

```
Service Layer          → returns Result<T, E>
Route Handler (API)    → maps Result to Response via errorResponse()
React Error Boundary   → catches unrecoverable throws
```

### Service Functions Return Results

```typescript
// services/conversations.ts
import { db } from '@/db/client';
import { conversations, messages, files } from '@/db/schema';
import type { Conversation, Message, FileRecord } from '@/db/schema';
import type { FileDataContext } from '@/types/file';
import type { Result } from '@/types/result';
import type { NotFoundError } from '@/types/errors';
import { ok, err } from '@/types/result';
import { eq, and, desc } from 'drizzle-orm';

export async function getConversation(
  conversationId: string,
  userId: string,
): Promise<Result<Conversation, NotFoundError>> {
  const convo = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
  });

  if (!convo) {
    return err({
      type: 'NOT_FOUND',
      resource: 'conversation',
      id: conversationId,
    });
  }

  return ok(convo);
}

export async function getConversationFileData(conversationId: string): Promise<Result<FileDataContext | null, never>> {
  const file = await db.query.files.findFirst({
    where: eq(files.conversationId, conversationId),
    orderBy: [desc(files.createdAt)],
  });

  if (!file) return ok(null);

  return ok({
    fileName: file.fileName,
    columnNames: file.columnNames,
    rowCount: file.rowCount,
    sampleData: file.sampleData,
  });
}

export async function listConversations(userId: string): Promise<Result<Conversation[], never>> {
  const convos = await db.query.conversations.findMany({
    where: eq(conversations.userId, userId),
    orderBy: [desc(conversations.updatedAt)],
  });

  return ok(convos);
}

export async function deleteConversation(conversationId: string, userId: string): Promise<Result<void, NotFoundError>> {
  const convo = await getConversation(conversationId, userId);
  if (!convo.ok) return convo;

  await db.delete(conversations).where(eq(conversations.id, conversationId));
  return ok(undefined);
}
```

### Route Handlers Map Results to Responses

```typescript
// app/api/conversations/[id]/route.ts
import { withAuthHandler } from '@/lib/api';
import { getConversation, deleteConversation } from '@/services/conversations';
import { errorResponse } from '@/types/errors';

export const GET = withAuthHandler(async (req, { user, params }) => {
  const result = await getConversation(params.id, user.id);

  if (!result.ok) return errorResponse(result.error);

  return Response.json(result.value);
});

export const DELETE = withAuthHandler(async (req, { user, params }) => {
  const result = await deleteConversation(params.id, user.id);

  if (!result.ok) return errorResponse(result.error);

  return new Response(null, { status: 204 });
});
```

### File Upload Validation with Results

```typescript
// services/files.ts
import type { Result } from '@/types/result';
import type { FileError } from '@/types/errors';
import type { ParsedFileData } from '@/types/file';
import { ok, err } from '@/types/result';
import { FILE_LIMITS, ALLOWED_FILE_TYPES } from '@/types/file';
import type { AllowedFileType } from '@/types/file';

export function validateFile(file: File): Result<void, FileError> {
  if (!ALLOWED_FILE_TYPES.includes(file.type as AllowedFileType)) {
    return err({
      type: 'FILE_ERROR',
      message: `Invalid file type: ${file.type}. Allowed: CSV, XLSX.`,
      code: 'INVALID_TYPE',
    });
  }

  if (file.size > FILE_LIMITS.maxSizeBytes) {
    return err({
      type: 'FILE_ERROR',
      message: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB.`,
      code: 'TOO_LARGE',
    });
  }

  return ok(undefined);
}

export function parseFileContents(buffer: Buffer, fileType: string): Result<ParsedFileData, FileError> {
  try {
    let rows: Record<string, unknown>[];

    if (fileType === 'text/csv') {
      const parsed = Papa.parse(buffer.toString(), { header: true });
      rows = parsed.data as Record<string, unknown>[];
    } else {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    }

    const columnNames = Object.keys(rows[0] ?? {});

    if (columnNames.length > FILE_LIMITS.maxColumns) {
      return err({
        type: 'FILE_ERROR',
        message: `Too many columns: ${columnNames.length}. Max: ${FILE_LIMITS.maxColumns}.`,
        code: 'TOO_MANY_COLUMNS',
      });
    }

    const truncated = rows.length > FILE_LIMITS.maxRows;
    if (truncated) rows = rows.slice(0, FILE_LIMITS.maxRows);

    return ok({ rows, columnNames, rowCount: rows.length, truncated });
  } catch {
    return err({
      type: 'FILE_ERROR',
      message: 'Failed to parse file. Ensure it is a valid CSV or XLSX.',
      code: 'PARSE_FAILED',
    });
  }
}
```

### When Errors Still Throw

Infrastructure failures remain exceptions. They bubble up to:

1. **Route handlers** — Next.js catches and returns 500
2. **React Error Boundaries** — catch rendering failures in the UI

```typescript
// components/error-boundary.tsx
'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
```

---

## 7. Authentication (WorkOS AuthKit)

### Flow

1. User visits app → **proxy** checks session (Next.js 16 uses `proxy.ts`)
2. Unauthenticated → redirect to WorkOS hosted auth page (Google OAuth)
3. After auth → callback route handles token exchange
4. Session cookie set → user ID available via `withAuth()`
5. On first login → atomic upsert user record in `users` table

### Key Files

```
├── proxy.ts                  # authkitMiddleware() — protects all routes (Next.js 16+)
├── app/
│   ├── auth/callback/
│   │   └── route.ts          # handleAuth() — OAuth callback
│   └── layout.tsx            # <AuthKitProvider initialAuth> wrapping app
```

### Environment Variables

```env
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
WORKOS_COOKIE_PASSWORD=<32+ char random string>
```

### Proxy Setup (Next.js 16)

Next.js 16 uses `proxy.ts` instead of `middleware.ts`. Using `middleware.ts` shows a deprecation warning. Having both files throws **error E900**.

```typescript
// proxy.ts (project root, next to app/)
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

export default authkitMiddleware();

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### AuthKitProvider with Optimized Initial Auth

Avoid redundant server roundtrips by passing initial auth data from the server:

```typescript
// app/layout.tsx
import { withAuth } from '@workos-inc/authkit-nextjs';
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const auth = await withAuth();
  const { accessToken, ...initialAuth } = auth; // Exclude token from client bundle

  return (
    <html lang="en">
      <body>
        <AuthKitProvider initialAuth={initialAuth}>
          {children}
        </AuthKitProvider>
      </body>
    </html>
  );
}
```

### Authenticated Route Handler (SOLID: Single Responsibility + Open/Closed)

Auth + user sync lives in one place. Route handlers don't change if auth logic changes.

```typescript
// lib/api.ts
import { withAuth } from '@workos-inc/authkit-nextjs';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import type { User as WorkOSUser } from '@workos-inc/node';

export interface AuthContext {
  readonly user: WorkOSUser;
}

type AuthenticatedHandler = (req: Request, ctx: AuthContext) => Promise<Response>;

export function withAuthHandler(handler: AuthenticatedHandler) {
  return async (req: Request): Promise<Response> => {
    const { user } = await withAuth({ ensureSignedIn: true });

    // Atomic upsert — no race condition
    await db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        name: user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : null,
        avatarUrl: user.profilePictureUrl ?? null,
      })
      .onConflictDoNothing({ target: users.id });

    return handler(req, { user });
  };
}
```

**Usage in any route handler:**

```typescript
// app/api/conversations/route.ts
import { withAuthHandler } from '@/lib/api';
import { listConversations } from '@/services/conversations';
import { errorResponse } from '@/types/errors';

export const GET = withAuthHandler(async (req, { user }) => {
  const result = await listConversations(user.id);
  if (!result.ok) return errorResponse(result.error);
  return Response.json(result.value);
});
```

---

## 8. File Upload & Ingestion

### API Route: `POST /api/upload`

```
Request: multipart/form-data
  - file: File (CSV or XLSX, max 5MB)
  - conversationId: string

Response: UploadResponse (see types/api.ts)
```

### Storage Strategy

1. **Raw file → Vercel Blob** — original CSV/XLSX stored for download/reference
2. **Metadata + sample → PostgreSQL** — `columnNames`, `rowCount`, first 100 rows as `sampleData` JSONB
3. Keeps the DB lightweight (no multi-MB JSONB blobs per file)

### Upload Route (Services Return Results)

```typescript
// app/api/upload/route.ts
import { put } from '@vercel/blob';
import { withAuthHandler } from '@/lib/api';
import { validateFile, parseFileContents } from '@/services/files';
import { errorResponse } from '@/types/errors';
import { FILE_LIMITS } from '@/types/file';
import type { UploadResponse } from '@/types/api';

export const POST = withAuthHandler(async (req, { user }) => {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const conversationId = formData.get('conversationId') as string;

  // 1. Validate (returns Result, not throw)
  const validation = validateFile(file);
  if (!validation.ok) return errorResponse(validation.error);

  // 2. Parse contents
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseFileContents(buffer, file.type);
  if (!parsed.ok) return errorResponse(parsed.error);

  // 3. Upload raw file to Vercel Blob
  const blob = await put(file.name, file, { access: 'public' });

  // 4. Save metadata to DB
  const sampleData = parsed.value.rows.slice(0, FILE_LIMITS.sampleSize);
  const [fileRecord] = await db
    .insert(files)
    .values({
      userId: user.id,
      conversationId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      blobUrl: blob.url,
      columnNames: parsed.value.columnNames,
      rowCount: parsed.value.rowCount,
      sampleData,
    })
    .returning();

  const response: UploadResponse = {
    fileId: fileRecord.id,
    fileName: fileRecord.fileName,
    blobUrl: fileRecord.blobUrl,
    columnNames: parsed.value.columnNames,
    rowCount: parsed.value.rowCount,
    preview: parsed.value.rows.slice(0, 5),
    truncated: parsed.value.truncated,
  };

  return Response.json(response);
});
```

---

## 9. LLM Agent (Tool-Based Architecture)

### Multi-Model Routing via Tools

Instead of a classification router or regex-based artifact extraction, the AI SDK's **tool calling** lets the analysis model decide when to generate an artifact. The codegen model is called _inside_ the tool's `execute()` function.

| Task                          | Model           | Mechanism                                                              |
| ----------------------------- | --------------- | ---------------------------------------------------------------------- |
| Chat analysis + routing       | `gpt-4.1-mini`  | `streamText` with tools, `stopWhen: stepCountIs(3)`                    |
| Data analysis (optional step) | `gpt-4.1-mini`  | `analyzeData` tool — returns insights, shows as collapsible "Analysis" |
| Artifact code generation      | `gpt-5.3-codex` | Called inside `generateArtifact` tool `execute()`                      |
| Error correction              | `gpt-5.3-codex` | Same tool, re-invoked on error                                         |
| Title generation              | `gpt-5.4-nano`  | `generateText` + `Output.object()`                                     |

### Multi-Step Tool Chain

The model can execute **up to 3 steps** per request (`stopWhen: stepCountIs(3)`). A typical chain for a complex request:

```
Step 1: Model calls analyzeData → examines columns, detects types, finds patterns
Step 2: Model reads analysis result, calls generateArtifact → codegen model produces React code
Step 3: Model writes final text summary explaining the visualization
```

For simple questions (e.g., "how many rows?"), the model skips tools entirely and responds in text.

### API Route: `POST /api/chat`

```typescript
// app/api/chat/route.ts
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withAuthHandler } from '@/lib/api';
import { getConversation, getConversationFileData } from '@/services/conversations';
import { errorResponse } from '@/types/errors';
import { chatBodySchema } from '@/types/api';
import { buildAnalysisPrompt } from '@/lib/system-prompt';
import { createChatTools } from '@/lib/tools';
import { AI_MODELS } from '@/types/ai';

export const POST = withAuthHandler(async (req, { user }) => {
  const body = await req.json();
  const { conversationId } = chatBodySchema.parse(body);
  const messages = body.messages as UIMessage[];

  const [convoResult, fileResult] = await Promise.all([
    getConversation(conversationId, user.id),
    getConversationFileData(conversationId),
  ]);

  if (!convoResult.ok) return errorResponse(convoResult.error);

  const fileData = fileResult.ok ? fileResult.value : null;

  const result = streamText({
    model: openai(AI_MODELS.analysis),
    system: buildAnalysisPrompt(fileData),
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 4096,
    stopWhen: stepCountIs(3),
    tools: createChatTools(fileData),
  });

  return result.toUIMessageStreamResponse();
});
```

### System Prompts (Analysis + Codegen)

Two specialized prompts — the analysis model reasons about data, the codegen model writes code.

```typescript
// lib/system-prompt.ts
import type { FileDataContext } from '@/types/file';

/** Prompt for gpt-4.1-mini: analyze data, decide when to call generateArtifact tool. */
export function buildAnalysisPrompt(fileData: FileDataContext | null): string {
  const dataContext = fileData
    ? `
## Available Data
- File: "${fileData.fileName}"
- Columns: ${fileData.columnNames.join(', ')}
- Row count: ${fileData.rowCount}
- Sample data (first 20 rows):
\`\`\`json
${JSON.stringify(fileData.sampleData.slice(0, 20), null, 2)}
\`\`\`
`
    : 'No file has been uploaded yet.';

  return `You are a data analysis assistant. Users upload CSV/Excel files and ask questions about them. You can generate **any kind of interactive React component** — not just charts. Think broadly: dashboards, trackers, calendars, data tables, forms, stat cards, kanban boards, or any combination that best represents the data.

${dataContext}

## Your Role

1. Analyze the user's question about their data.
2. When the data needs exploration first, call \`analyzeData\` to examine specific columns and detect patterns.
3. When an interactive artifact would help, call \`generateArtifact\` with a detailed description of what to build.
4. After generating an artifact, provide a brief text summary of what was created and key insights.

## Tool Chain Strategy

- **Simple questions** ("how many rows?", "what are the columns?") → answer in text only, no tools
- **Clear artifact request** ("bar chart of sales by region", "build a tracker for this") → call \`generateArtifact\` directly
- **Exploratory/complex requests** ("analyze this data and show me something useful") → call \`analyzeData\` first, then \`generateArtifact\` based on what you find
- **Ambiguous data** (many columns, unclear structure) → call \`analyzeData\` first to understand the data before deciding what to build

## Choosing the Right Artifact Type

Match the artifact to the data structure and user intent:

- **Tabular data with categories** (sales by region, expenses by dept) → charts (bar, pie, line)
- **Time-series data** (monthly revenue, daily metrics) → line/area charts, trend dashboards
- **Tracker/log data** (leave requests, project tasks, inventory) → interactive tables, trackers, calendar views, kanban boards
- **Multi-dimensional data** → dashboards combining multiple visualizations
- **Status/workflow data** (approval states, pipeline stages) → stat cards + filtered lists
- **Any data the user wants to "turn into an app"** → rich interactive UI with filtering, sorting, tabs, and proper layout

When in doubt, prefer a **richer interactive UI** over a simple chart. The artifact should feel like a useful mini-app, not just a static visualization.

## Description Quality

The \`description\` field in generateArtifact is the primary input to the code generator. Be thorough:
- Specify the UI components to use (table, chart type, cards, calendar, etc.)
- Describe the data mapping (which columns go where)
- Mention interactions (sort, filter, search, tabs)
- Describe the layout (grid, sidebar + main, stacked sections)

## Error Correction

If the user reports an error in the artifact, analyze the error message and call generateArtifact again with a corrected description. Include the error details in the description field so the code generator can fix the issue.

Always double-check column names against the available data before calling any tool.`;
}

/** Prompt for gpt-5.3-codex: generate self-contained React artifact code. */
export function buildCodegenPrompt(fileData: FileDataContext | null): string {
  const sampleJson = fileData ? JSON.stringify(fileData.sampleData.slice(0, 20), null, 2) : '[]';

  return `You are a code generator that produces self-contained, interactive React components. You can build ANY type of UI: charts, dashboards, data tables, trackers, calendars, forms, kanban boards, stat card layouts, or any combination.

## Available Data
${fileData ? `- Columns: ${fileData.columnNames.join(', ')}\n- Total rows: ${fileData.rowCount}\n- Sample data:\n\`\`\`json\n${sampleJson}\n\`\`\`` : 'No data available.'}

## Output Rules

- Output ONLY the component code. No markdown, no explanation, no fenced code blocks.
- Default-export a React functional component using TypeScript/TSX.
- Import React and hooks (useState, useMemo, etc.) from "react".
- For charts: import from "recharts" (BarChart, LineChart, PieChart, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, etc.). Make charts responsive with \`<ResponsiveContainer width="100%" height={400}>\`.
- For everything else (tables, trackers, calendars, forms, cards, etc.): use plain HTML elements with inline styles. No external UI library needed.
- Embed the data as a \`const DATA = [...]\` at the top. Use the FULL dataset (all ${fileData?.rowCount ?? 'N'} rows).
- The component must be completely self-contained — no imports beyond React and Recharts.
- Use clean, modern inline styles with a professional color palette.

## UI Patterns

- **Data tables**: styled HTML table with headers, zebra striping, sortable columns (onClick), optional search/filter input at top.
- **Stat cards**: grid of summary cards at the top (count, sum, average, etc.), each with a label, value, and optional trend indicator.
- **Dashboards**: combine stat cards + charts + tables in a CSS grid layout. Main title and description at the top. Each section gets its own heading.
- **Trackers/lists**: grouped items with status badges (colored spans), filter tabs, and clear visual hierarchy.
- **Calendars**: month grid layout with data items placed on their date cells. Color-coded by category/status.
- **Forms/editors**: input fields bound to state for interactive filtering, editing, or data entry simulation.

## Styling Guidelines

- Use CSS grid or flexbox for layouts.
- Professional, clean aesthetic. No heavy shadows. Subtle borders (\`1px solid #e5e5e5\`).
- Status colors: green for positive/approved, amber/yellow for pending, red for rejected/error, blue for info.
- Consistent spacing: 16px/24px padding, 8px/12px gaps.
- Pleasant font sizing: 14px body, 12px captions, 20-24px headings.
- Ensure components are interactive where appropriate (hover states, click handlers, filters).`;
}
```

### Message Persistence

After each completed AI response, persist both messages in a single transaction and update the conversation's `updatedAt`:

```typescript
// services/messages.ts
import { db } from '@/db/client';
import { messages as messagesTable, conversations as conversationsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Result } from '@/types/result';
import { ok } from '@/types/result';

export async function persistChatExchange(
  conversationId: string,
  userMessage: string,
  assistantResponse: string,
): Promise<Result<void, never>> {
  await db.transaction(async (tx) => {
    await tx.insert(messagesTable).values({
      conversationId,
      role: 'user',
      content: userMessage,
    });

    await tx.insert(messagesTable).values({
      conversationId,
      role: 'assistant',
      content: assistantResponse,
    });

    await tx.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversationId));
  });

  return ok(undefined);
}
```

### Auto-Title Generation

```typescript
// services/ai.ts
import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { AI_MODELS } from '@/types/ai';

export async function generateTitle(firstMessage: string): Promise<string> {
  const result = await generateText({
    model: openai(AI_MODELS.title),
    output: Output.object({
      schema: z.object({
        title: z.string().describe('A short 3-6 word title for this conversation'),
      }),
    }),
    prompt: `Generate a concise title for a data analysis chat that starts with: "${firstMessage}"`,
  });
  return result.output?.title ?? 'New Chat';
}
```

---

## 10. Artifact System (Sandpack)

### How It Works

1. Analysis model (`gpt-4.1-mini`) calls `generateArtifact` tool when an interactive UI would help
2. Tool's `execute()` calls codegen model (`gpt-5.3-codex`) → returns `{ title, code }` as typed tool output
3. Frontend receives tool invocation part with `state: 'result'` containing the code
4. Code is passed to a **lazy-loaded** Sandpack instance pre-configured with React (+ Recharts available for charts)
5. Sandpack compiles and renders the component in a sandboxed iframe
6. Artifacts can be anything: charts, dashboards, data tables, trackers, calendars, forms, stat cards, or any combination
7. If runtime error occurs → error is captured and can be sent back to the LLM via chat

### Sandpack Configuration (Lazy-Loaded)

Sandpack is ~2MB — it **must** be lazy-loaded with `next/dynamic` to avoid destroying TTI/LCP.

```typescript
// components/artifact-panel.tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ArtifactPanelProps } from '@/types/components';
import { MAX_ARTIFACT_RETRIES } from '@/types/chat';

const ArtifactSandpack = dynamic(
  () => import('./artifact-sandpack').then((m) => m.ArtifactSandpack),
  { ssr: false, loading: () => <div className="animate-pulse h-full bg-muted" /> },
);

type ArtifactView = 'preview' | 'code';

export function ArtifactPanel({ title, code, error, retryCount, onFixError }: ArtifactPanelProps) {
  const [view, setView] = useState<ArtifactView>('preview');

  if (!code) return <EmptyArtifactState />;

  return (
    <div className="flex flex-col h-full border-l">
      {/* Header: title + view toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium truncate">{title ?? 'Artifact'}</span>
        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
          <button
            onClick={() => setView('preview')}
            className={cn(
              'rounded px-2 py-1 text-xs',
              view === 'preview' ? 'bg-muted font-medium' : 'text-muted-foreground',
            )}
            aria-label="Preview"
          >
            {/* Eye icon */}
            Preview
          </button>
          <button
            onClick={() => setView('code')}
            className={cn(
              'rounded px-2 py-1 text-xs',
              view === 'code' ? 'bg-muted font-medium' : 'text-muted-foreground',
            )}
            aria-label="Code"
          >
            {/* Code icon */}
            {'</>'}
          </button>
        </div>
      </div>

      {/* Content: Sandpack in preview or code mode */}
      <div className="flex-1 overflow-hidden">
        <ArtifactSandpack code={code} view={view} />
      </div>

      {/* Error bar */}
      {error && retryCount < MAX_ARTIFACT_RETRIES && (
        <div className="p-3 border-t">
          <p className="text-sm text-destructive mb-2">{error}</p>
          <button onClick={onFixError}>Fix Error</button>
        </div>
      )}
      {error && retryCount >= MAX_ARTIFACT_RETRIES && (
        <p className="p-3 text-sm text-muted-foreground">
          Max retries reached. Please clarify your request.
        </p>
      )}
    </div>
  );
}
```

```typescript
// components/artifact-sandpack.tsx
'use client';

import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
} from '@codesandbox/sandpack-react';

interface ArtifactSandpackProps {
  readonly code: string;
  readonly view: 'preview' | 'code';
}

export function ArtifactSandpack({ code, view }: ArtifactSandpackProps) {
  const files = {
    '/App.tsx': code,
    '/index.tsx': `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
    `,
  };

  return (
    <SandpackProvider
      template="react-ts"
      files={files}
      customSetup={{
        dependencies: {
          recharts: 'latest',
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
      }}
      options={{
        visibleFiles: ['/App.tsx'],
      }}
    >
      {view === 'preview' ? (
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={true}
          style={{ height: '100%', minHeight: '500px' }}
        />
      ) : (
        <SandpackCodeEditor
          showTabs={false}
          showLineNumbers
          readOnly
          style={{ height: '100%', minHeight: '500px' }}
        />
      )}
    </SandpackProvider>
  );
}
```

### Error Feedback Loop

```typescript
// hooks/use-artifact-errors.ts
import { useSandpack } from '@codesandbox/sandpack-react';
import { useState, useEffect } from 'react';

export function useArtifactErrors() {
  const { listen } = useSandpack();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = listen((msg) => {
      if (msg.type === 'action' && msg.action === 'show-error') {
        setError(msg.message);
      }
      if (msg.type === 'done') {
        setError(null);
      }
    });
    return unsubscribe;
  }, [listen]);

  return { error };
}
```

### Why Sandpack?

| Approach        | Pros                                                                                                 | Cons                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Sandpack** ✅ | Runs entirely in browser, no server cost, fast iteration, built-in error handling, supports npm deps | Limited to what runs in browser, no filesystem access      |
| e2b / Modal     | Full server-side execution, can run anything                                                         | Adds latency, costs money per execution, requires API keys |
| V8 Isolates     | Fast, lightweight                                                                                    | No DOM access (can't render React), complex setup          |
| Raw eval/iframe | Zero dependencies                                                                                    | Massive security risk, no TypeScript, no imports           |

**Sandpack is the best fit** for this MVP because artifacts are self-contained React components (charts, tables, trackers, dashboards, etc.) that only need browser APIs, and it provides the best DX with zero server cost.

---

## 11. Chat UI (Frontend)

### Layout: Three-Panel with Suspense

```
┌──────────┬─────────────────────────┬──────────────────────────────┐
│          │                         │ Title        [Preview][</>]  │
│ Sidebar  │     Chat Panel          │──────────────────────────────│
│ (280px)  │     (flexible)          │                              │
│          │                         │  Sandpack Preview            │
│ • Convos │  ┌─────────────────┐    │  (lazy-loaded)               │
│ • + New  │  │ Message List    │    │  - or -                      │
│          │  │ (scrollable)    │    │  Sandpack Code Editor        │
│          │  │                 │    │  (read-only, syntax hl)      │
│          │  │ ▶ Analysis      │    │                              │
│          │  │ ┌─────────────┐ │    │                              │
│          │  │ │ Artifact    │ │    │                              │
│          │  │ │ Card        │ │    │                              │
│          │  │ └─────────────┘ │    │                              │
│          │  └─────────────────┘    │  [Fix Error] (if error)      │
│          │  ┌─────────────────┐    │                              │
│          │  │ Input + Upload  │    │                              │
│          │  └─────────────────┘    │                              │
└──────────┴─────────────────────────┴──────────────────────────────┘
```

- **Artifact panel** is hidden by default, appears when an artifact is generated
- On mobile: artifact panel is a bottom sheet or full-screen overlay
- **Suspense boundaries** wrap each panel for streaming RSC data

### Chat Layout with Suspense

```tsx
// app/chat/layout.tsx
import { Suspense } from 'react';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

### Conversation Page with Suspense

```tsx
// app/chat/[conversationId]/page.tsx
import { Suspense } from 'react';

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;

  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatPanel conversationId={conversationId} />
    </Suspense>
  );
}
```

### Client-Side Chat Hook (AI SDK `useChat`)

```typescript
// hooks/use-app-chat.ts
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export function useAppChat(conversationId: string) {
  const [input, setInput] = useState('');

  const chat = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { conversationId },
    }),
  });

  const handleSend = () => {
    if (!input.trim()) return;
    chat.sendMessage({ text: input });
    setInput('');
  };

  // AI SDK v6: no isLoading — derive from status
  const isLoading = chat.status === 'submitted' || chat.status === 'streaming';

  return {
    messages: chat.messages,
    status: chat.status,
    isLoading,
    sendMessage: chat.sendMessage,
    input,
    setInput,
    handleSend,
  };
}
```

### Chat Panel — Typed Tool Parts (No Regex)

The AI SDK v6 provides **typed tool parts** in `message.parts`. Each tool gets its own part type: `'tool-analyzeData'`, `'tool-generateArtifact'` (format: `'tool-${toolName}'`). The `state` field indicates progress:

- `'input-streaming'` → tool input is being generated (show skeleton)
- `'input-available'` → tool call sent, waiting for execution (show loading)
- `'output-available'` → tool returned output (render artifact) — access via `part.output`
- `'output-error'` → tool execution failed — access via `part.errorText`

**Note:** `UIMessage` has NO `content` field — only `parts`. The server must use `convertToModelMessages()` to convert `UIMessage[]` before passing to `streamText`.

```typescript
// components/chat-panel.tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import { useAppChat } from '@/hooks/use-app-chat';
import type { ArtifactState } from '@/types/chat';
import type { ArtifactToolOutput } from '@/types/ai';

export function ChatPanel({ conversationId }: { conversationId: string }) {
  const { messages, isLoading, input, setInput, handleSend, sendMessage } =
    useAppChat(conversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [artifactState, setArtifactState] = useState<ArtifactState>({
    code: null,
    error: null,
    retryCount: 0,
  });

  // Derive latest artifact from typed tool parts
  // AI SDK v6: part.type is 'tool-generateArtifact', state is 'output-available', result is part.output
  let latestArtifact: ArtifactToolOutput | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts ?? []) {
      if (
        part.type === 'tool-generateArtifact' &&
        part.state === 'output-available'
      ) {
        latestArtifact = part.output as ArtifactToolOutput;
        break;
      }
    }
    if (latestArtifact) break;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <MessageInput
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          isLoading={isLoading}
          conversationId={conversationId}
        />
      </div>
      {latestArtifact && (
        <ArtifactPanel
          title={latestArtifact.title}
          code={latestArtifact.code}
          error={artifactState.error}
          retryCount={artifactState.retryCount}
          onFixError={() => {
            sendMessage({
              text: `The artifact produced this error: ${artifactState.error}. Please fix the code.`,
            });
          }}
        />
      )}
    </div>
  );
}
```

### MessageBubble — Renders Text + Tool Parts

Each message can contain text parts and tool invocation parts. Tool results render as:

- **`analyzeData`** → collapsible "Analysis" section (like Claude's "Analysis >" in the screenshot)
- **`generateArtifact`** → clickable artifact card with title and thumbnail icon

```typescript
// components/message-bubble.tsx
'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { AnalysisToolOutput, ArtifactToolOutput } from '@/types/ai';
import type { UIMessage } from 'ai';

// AI SDK v6: UIMessage has no 'content' — only 'parts'. Use UIMessage directly.
export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%]', isUser && 'rounded-2xl bg-primary/10 px-4 py-2')}>
        <div className="prose prose-sm max-w-none">
          {message.parts.map((part, i) => {
            if (part.type === 'text') {
              return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>;
            }

            // AI SDK v6: tool parts have type 'tool-{toolName}' (e.g., 'tool-analyzeData')
            if (part.type.startsWith('tool-')) {
              const toolName = part.type.slice(5);
              return <ToolInvocationPart key={i} toolName={toolName} part={part} />;
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}

// AI SDK v6 tool states: 'input-streaming', 'input-available', 'output-available', 'output-error'
// Result is on part.output (not part.result)
function ToolInvocationPart({ toolName, part }: { toolName: string; part: any }) {
  const [expanded, setExpanded] = useState(false);

  if (toolName === 'analyzeData') {
    if (part.state === 'input-streaming' || part.state === 'input-available') {
      return (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <span className="animate-pulse">●</span> Analyzing data...
        </div>
      );
    }
    if (part.state === 'output-available') {
      const result = part.output as AnalysisToolOutput;
      return (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <span className={cn('transition-transform', expanded && 'rotate-90')}>▶</span>
            Analysis
          </button>
          {expanded && (
            <div className="border-l pl-4 text-sm text-muted-foreground">
              <p>{result.summary}</p>
              {result.insights.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {result.insights.map((insight, j) => <li key={j}>{insight}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      );
    }
  }

  if (toolName === 'generateArtifact') {
    if (part.state === 'input-streaming' || part.state === 'input-available') {
      return (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <span className="animate-pulse">●</span> Generating visualization...
        </div>
      );
    }
    if (part.state === 'output-available') {
      const result = part.output as ArtifactToolOutput;
      return (
        <div className="my-2 flex cursor-pointer items-center gap-3 rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium">{result.title}</p>
            <p className="text-xs text-muted-foreground">Interactive artifact</p>
          </div>
        </div>
      );
    }
  }

  return null;
}
```

---

## 12. File Structure

```
├── app/
│   ├── layout.tsx                    # Root layout: AuthKitProvider (initialAuth), fonts
│   ├── page.tsx                      # Landing / redirect to /chat
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts              # WorkOS OAuth callback: handleAuth()
│   ├── chat/
│   │   ├── layout.tsx                # Chat layout: Suspense sidebar + main area
│   │   ├── page.tsx                  # Default: "Select or create a conversation"
│   │   └── [conversationId]/
│   │       └── page.tsx              # Individual conversation view with Suspense
│   └── api/
│       ├── chat/
│       │   └── route.ts              # POST: AI streaming (withAuthHandler)
│       ├── upload/
│       │   └── route.ts              # POST: File upload + parse + Blob (withAuthHandler)
│       └── conversations/
│           ├── route.ts              # GET: list, POST: create (withAuthHandler)
│           └── [id]/
│               └── route.ts          # GET: detail, DELETE: remove (withAuthHandler)
├── components/
│   ├── ui/                           # Shadcn components (direct imports, no barrels)
│   ├── sidebar.tsx                   # Conversation list + new chat button
│   ├── chat-panel.tsx                # Message list + typed tool part rendering
│   ├── message-bubble.tsx            # Text + tool parts (analysis collapse, artifact card)
│   ├── message-input.tsx             # Text input + file upload button
│   ├── artifact-panel.tsx            # Header (title + preview/code toggle) + lazy Sandpack
│   ├── artifact-sandpack.tsx         # Sandpack provider + preview OR code editor (loaded on demand)
│   ├── file-upload-badge.tsx         # Shows uploaded file info (minimal props)
│   └── error-boundary.tsx            # Error boundary for unrecoverable throws
├── hooks/
│   ├── use-app-chat.ts              # useChat wrapper with conversation context
│   ├── use-artifact-errors.ts        # Sandpack error capture hook
│   └── use-conversations.ts          # SWR hook for conversation list
├── services/
│   ├── conversations.ts              # Conversation CRUD (returns Result<T, E>)
│   ├── messages.ts                   # Message persistence (transactions)
│   ├── files.ts                      # File validation + parsing (returns Result<T, E>)
│   └── ai.ts                         # Title generation (gpt-5.4-nano)
├── types/
│   ├── result.ts                     # Result<T, E>, ok(), err()
│   ├── errors.ts                     # AppError union, errorResponse()
│   ├── api.ts                        # Zod schemas + API request/response interfaces
│   ├── ai.ts                         # AI_MODELS config, ArtifactToolInput/Output
│   ├── chat.ts                       # ArtifactState, MAX_ARTIFACT_RETRIES
│   ├── file.ts                       # AllowedFileType, ParsedFileData, FILE_LIMITS
│   └── components.ts                 # Component prop interfaces (ISP)
├── lib/
│   ├── api.ts                        # withAuthHandler HOF (auth + user sync)
│   └── system-prompt.ts              # Analysis + codegen prompt builders
├── db/
│   ├── schema.ts                     # Drizzle schema (UUIDv7, timestamptz, FK indexes)
│   ├── client.ts                     # Drizzle client instance (PlanetScale)
│   └── migrations/                   # Generated by drizzle-kit
├── proxy.ts                          # WorkOS authkitMiddleware() (Next.js 16)
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── .env
```

---

## 13. Visual Design System

### Design Philosophy

Light theme, minimal and clean. No gradients, no glassmorphism, no heavy shadows. The UI should feel professional and content-focused — let the data and artifacts be the visual interest, not the chrome. Use Shadcn/ui defaults with minimal customization.

### Typography

Two font families:

| Font           | Tailwind Class | Role      | Usage                                                                                 |
| -------------- | -------------- | --------- | ------------------------------------------------------------------------------------- |
| **Inter**      | `font-sans`    | Body / UI | All body text, headings, buttons, navigation, labels, inputs. Default for everything. |
| **Geist Mono** | `font-mono`    | Code      | Artifact code view (Sandpack editor), inline code references, file names.             |

```typescript
// app/layout.tsx — font setup
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = localFont({
  src: './fonts/geist-mono.woff2',
  variable: '--font-mono',
});
```

**Type scale** (using Tailwind defaults):

| Element               | Class                                  | Weight |
| --------------------- | -------------------------------------- | ------ |
| Empty state heading   | `text-3xl font-bold`                   | 700    |
| Page/section headings | `text-lg font-semibold`                | 600    |
| Body text / messages  | `text-sm`                              | 400    |
| Muted / secondary     | `text-sm text-muted-foreground`        | 400    |
| Labels / captions     | `text-xs text-muted-foreground`        | 400    |
| Sidebar nav items     | `text-sm font-medium`                  | 500    |
| Brand wordmark        | SVG logo from `/public/branding/`      | —      |

### Color Palette

Light theme only. Built on Shadcn/ui CSS variables with Tailwind v4. Rebolt brand blue accent (#006AFE).

```css
/* app/globals.css — Shadcn theme overrides (light only) */
:root {
  --background: 0 0% 100%; /* #FFFFFF — pure white */
  --foreground: 0 0% 9%; /* #171717 — near-black text */

  --card: 0 0% 100%;
  --card-foreground: 0 0% 9%;

  --muted: 0 0% 96%; /* #F5F5F5 — subtle gray backgrounds */
  --muted-foreground: 0 0% 45%; /* #737373 — secondary text */

  --border: 0 0% 90%; /* #E5E5E5 — light borders */
  --input: 0 0% 90%;
  --ring: 215 100% 50%; /* Focus ring — Rebolt blue */

  --primary: 215 100% 50%; /* #006AFE — Rebolt brand blue */
  --primary-foreground: 0 0% 100%;

  --secondary: 0 0% 96%;
  --secondary-foreground: 0 0% 9%;

  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;

  --accent: 0 0% 96%;
  --accent-foreground: 0 0% 9%;

  --radius: 0.5rem; /* 8px — default border radius */
}
```

**Semantic color usage:**

| Token                   | Usage                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| `bg-background`         | Page background, panels                                               |
| `text-foreground`       | Primary text (headings, body)                                         |
| `text-muted-foreground` | Secondary text (timestamps, placeholders, labels)                     |
| `bg-muted`              | Subtle background fills (sidebar hover, empty states)                 |
| `border`                | Panel dividers, input borders, card borders                           |
| `bg-primary`            | Send button, active states                                            |
| `bg-primary/10`         | Light blue tint (user message bubbles, artifact card icon background) |
| `text-primary`          | Links, highlighted text, active nav items                             |

### Component Styling

Use Shadcn defaults. No custom component library. Key styling decisions:

**Input area:**

- Rounded container (`rounded-xl border bg-background`) with subtle border
- Attach button (+) and send button inline
- Send button: `rounded-lg bg-primary text-primary-foreground` — filled blue square with arrow icon
- Placeholder: `text-muted-foreground` — "Tell me what do you need"
- No heavy shadow. At most `shadow-sm` on focus.

**Messages:**

- User messages: `bg-primary/10 rounded-2xl px-4 py-2` — light blue tint, soft rounding. Aligned right or visually distinguished.
- Assistant messages: plain text on `bg-background`, no bubble. Left-aligned. Content-first.
- No avatar icons in messages (keep it clean).
- Comfortable vertical spacing between messages (`space-y-4`).

**Sidebar:**

- `w-[280px] border-r bg-background`
- Brand: SVG wordmark from `/public/branding/rebolt-wordmark-black.svg` at top
- Section labels: `text-xs font-medium text-muted-foreground uppercase tracking-wider`
- Nav items: `text-sm font-medium` with small icon (16px) + text. Hover: `bg-muted rounded-md`.
- Active item: `text-primary font-medium` or `bg-primary/10`
- New chat button: prominent, at top of conversation list

**Artifact panel:**

- `border-l bg-background`
- Header bar: `border-b bg-muted/30 px-4 py-2` with title + preview/code toggle
- Toggle pills: small `rounded-md border bg-background p-0.5` container with active state `bg-muted`
- Clean separation from chat panel via single `border-l`

**Artifact card (inline in chat):**

- `rounded-lg border bg-muted/30 p-3` — subtle, not heavy
- Small chart icon in `bg-primary/10 rounded-md` container
- Title in `text-sm font-medium`, subtitle "Interactive artifact" in `text-xs text-muted-foreground`
- `hover:bg-muted/50` for interactivity hint

**Empty state:**

- Centered vertically and horizontally in main area
- Large heading: `text-3xl font-bold` — e.g., "What do you need?"
- Input area directly below, no extra decoration
- Generous whitespace above and below

**Analysis collapsible:**

- Minimal: just `text-sm text-muted-foreground` with `▶` chevron
- No background, no border — inline with message flow
- Expanded: `border-l pl-4` indent with muted text

**File upload badge:**

- `rounded-md border bg-muted/30 px-3 py-1.5`
- File icon + name in `text-sm`, row count in `text-xs text-muted-foreground`
- Small X button to remove

### Spacing & Layout

- **Border radius**: `rounded-md` (6px) for buttons/badges, `rounded-lg` (8px) for cards/panels, `rounded-xl` (12px) for input area, `rounded-2xl` (16px) for message bubbles
- **Shadows**: Almost none. `shadow-sm` only on the input area (focused state). No card shadows.
- **Borders**: `border` (1px solid) for panel separators and input outlines. Not heavy.
- **Panel gaps**: sidebar `border-r`, artifact `border-l` — single pixel dividers, no gap/margin between panels.
- **Content max-width**: Messages area constrained to `max-w-3xl mx-auto` for readability.
- **Message spacing**: `space-y-4` between messages, `py-6 px-4` for the message area padding.

### States

| State                    | Visual Treatment                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Empty conversation**   | Centered heading + input. No sidebar conversation list (or shows "0 conversations"). Clean, inviting.                |
| **Sending message**      | User bubble appears immediately. Below it: subtle spinner + "Analyzing..." in `text-muted-foreground animate-pulse`. |
| **Analysis in progress** | `● Analyzing data...` with pulsing dot, muted text. Inline in message flow.                                          |
| **Generating artifact**  | `● Generating visualization...` with pulsing dot. Artifact panel shows skeleton (`animate-pulse bg-muted`).          |
| **Artifact ready**       | Artifact card appears in chat. Panel opens with rendered preview. Toggle to code view available.                     |
| **Error in artifact**    | Destructive banner at bottom of artifact panel: error text + "Fix Error" button.                                     |
| **File attached**        | Small badge above input showing filename + row count. Removable with X.                                              |
| **Loading (Suspense)**   | Skeleton blocks matching the shape of the content they replace. `animate-pulse bg-muted rounded-md`.                 |

---

## 14. API Routes Detail

All routes are wrapped in `withAuthHandler()`. Services return `Result<T, E>` — route handlers map results to HTTP responses via `errorResponse()`.

### `POST /api/chat`

Validates `conversationId` with zod (`chatBodySchema`), extracts `messages` as `UIMessage[]`. Converts messages via `await convertToModelMessages(messages)`. Fetches conversation ownership + file data in parallel via `Promise.all()`. Both return `Result` — route checks `.ok` before proceeding. Uses `streamText` with `gpt-4.1-mini` + tools from `createChatTools()`. Tool's `execute()` internally calls `gpt-5.3-codex` for code generation. Streams via `toUIMessageStreamResponse()`.

### `POST /api/upload`

Validates file via `validateFile()` → `Result`. Parses via `parseFileContents()` → `Result`. Uploads raw file to Vercel Blob. Stores metadata + sample data in DB. Returns typed `UploadResponse`.

### `GET /api/conversations`

Calls `listConversations(user.id)` → `Result<Conversation[]>`. Returns JSON array.

### `POST /api/conversations`

Creates a new conversation. Returns the new conversation object.

### `GET /api/conversations/[id]`

Calls `getConversation(id, user.id)` → `Result`. Maps `NotFoundError` to 404.

### `DELETE /api/conversations/[id]`

Calls `deleteConversation(id, user.id)` → `Result`. Maps `NotFoundError` to 404. Cleans up Vercel Blob files.

---

## 15. Environment Variables

```env
# WorkOS AuthKit
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
WORKOS_COOKIE_PASSWORD=<32+ char random string>

# Database (PlanetScale Postgres — use pooled connection URL)
DATABASE_URL=postgresql://...

# OpenAI
OPENAI_API_KEY=sk-...

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

---

## 16. Data Flow Walkthrough

### Happy Path: User uploads CSV and asks for a chart

```
1. User signs in via Google (WorkOS) → session established
2. User clicks "New Chat" → POST /api/conversations → new conversation created
3. User attaches a CSV file → POST /api/upload
   - validateFile() → Result (checks type + size)
   - parseFileContents() → Result (parses CSV/XLSX)
   - Raw file uploaded to Vercel Blob
   - Metadata + sample data (100 rows) stored in `files` table
   - UI shows file badge with name + row count
4. User types "Turn this into a useful tracker"
   - Frontend sends messages array + conversationId to POST /api/chat
   - withAuthHandler verifies auth + upserts user atomically
   - getConversation() + getConversationFileData() in parallel (Promise.all)
   - Both return Result — route checks .ok before proceeding
   - gpt-4.1-mini receives analysis prompt + file context (stopWhen: stepCountIs(3))
   - **Step 1**: Model calls analyzeData tool → examines columns, finds patterns
   - **Step 2**: Model reads analysis, calls generateArtifact with detailed description
   - Tool execute() calls gpt-5.3-codex → returns { title, code }
   - **Step 3**: Model streams final text summary
   - All steps streamed to client as typed tool parts
5. Frontend renders tool parts progressively:
   - analyzeData (call) → "Analyzing data..." spinner
   - analyzeData (result) → collapsible "▶ Analysis" section
   - generateArtifact (call) → "Generating..." spinner
   - generateArtifact (result) → artifact card in chat + artifact panel opens
   - Text parts rendered as markdown
   - Code passed to lazy-loaded Sandpack (preview mode) → compiled and rendered
   - User can toggle to code view via `</>` button in artifact panel header
6. User sees interactive artifact (could be a tracker, dashboard, chart, table, etc.)
7. Messages persisted to DB in a single transaction (+ updatedAt bump)
8. Conversation title auto-generated via gpt-5.4-nano from first message
```

### Error Path: Generated code has a bug

```
1. gpt-5.3-codex generates artifact with a typo (e.g., wrong column name)
2. Sandpack renders → shows error overlay
3. Error captured via useArtifactErrors() hook
4. ArtifactPanel shows error + "Fix Error" button (checks retryCount < MAX_ARTIFACT_RETRIES)
5. Error message sent to chat:
   "The artifact produced this error: Cannot read property 'Sales'
    of undefined. Please fix the code."
6. gpt-4.1-mini analyzes error, calls generateArtifact tool again with corrected description
7. gpt-5.3-codex generates corrected code → streamed back
8. New artifact rendered in Sandpack → success
9. retryCount incremented (max 3 via MAX_ARTIFACT_RETRIES)
```

---

## 17. Sandpack Tradeoffs (for README)

### Why Sandpack over alternatives?

**Sandpack (chosen):**

- Runs entirely client-side — zero server execution cost
- Built-in TypeScript compilation via SWC/Babel
- First-class React support with hot module replacement
- Can load npm packages (Recharts) from CDN/bundled
- Error boundaries and error message capture
- Maintained by CodeSandbox/Vercel ecosystem

**Limitations vs. server-side execution (e2b, Modal):**

- Can't access the filesystem or make API calls from artifact code
- Limited to browser-compatible packages
- Memory/CPU constrained to the browser tab
- Can't run Python or other non-JS languages

**Limitations vs. V8 isolates:**

- Heavier bundle size (~2MB for Sandpack)
- Slower initial load (needs to boot a mini-bundler) — mitigated by lazy-loading with `next/dynamic`
- But: V8 isolates can't render DOM/React components at all

**For this MVP, Sandpack is ideal** because artifacts are self-contained React components that only need browser APIs. The tradeoff of no server-side execution is acceptable since we're building interactive UIs (charts, tables, trackers, dashboards), not running arbitrary backend code.

---

## 18. SOLID Architecture Principles

How each SOLID principle maps to concrete patterns in this codebase. Updated for **React 19** (no `forwardRef`, `use()` instead of `useContext()`).

### S — Single Responsibility

Every module has one reason to change.

| Module                          | Single Responsibility                     |
| ------------------------------- | ----------------------------------------- |
| `withAuthHandler`               | Auth + user sync only                     |
| `services/conversations.ts`     | Conversation CRUD only                    |
| `services/files.ts`             | File validation + parsing only            |
| `services/messages.ts`          | Message persistence only                  |
| `components/message-bubble.tsx` | Renders one message only                  |
| `components/artifact-panel.tsx` | Orchestrates artifact display only        |
| `hooks/use-app-chat.ts`         | Chat state only                           |
| `hooks/use-artifact-errors.ts`  | Error capture only                        |
| `lib/system-prompt.ts`          | Prompt building only (analysis + codegen) |

### O — Open/Closed

Open for extension, closed for modification.

- **AI tools**: Add new capabilities (e.g., `exportData`, `compareFiles`) by adding new `tool()` definitions to the chat route — existing tools and analysis prompt don't change
- **Artifact types**: New UI patterns (kanban, gantt, pivot table) require zero code changes — the codegen model generates any React component from the description
- **AI models**: Swap models by changing `AI_MODELS` config in `types/ai.ts` — no route or service code changes
- **File parsing**: Add new file formats (e.g., JSON, Parquet) by adding a parser to `services/files.ts` — existing parsers don't change
- **Message rendering**: New tool types added as new `case` branches in MessageBubble's tool part switch — existing cases untouched
- **Error types**: Add new `AppError` variants to the union — existing `errorResponse()` handles them via the `statusMap`

### L — Liskov Substitution

Any component/function satisfying an interface can be swapped.

- **Context providers** implement a generic `{ state, actions, meta }` interface — swap implementations without changing UI consumers (React 19 pattern: `use(Context)`)
- Components accepting `children: React.ReactNode` work with any valid ReactNode
- **React 19**: `ref` is a regular prop — any component accepting `ref` is substitutable (no `forwardRef` wrapper)

### I — Interface Segregation

Components and functions receive only what they use.

```typescript
// ❌ Passing entire DB entity to a presentation component
<MessageBubble message={fullMessageObject} />  // 8 fields, uses 3

// ✅ Passing only what it renders (see types/components.ts)
<MessageBubble role={msg.role} textContent={text} hasArtifact={!!artifact} />
```

- **`MessageBubble`**: receives only `message` with `id`, `role`, `content`, `parts` — not the full DB entity with timestamps, conversationId, etc.
- **`FileUploadBadgeProps`**: `fileName`, `rowCount`, `onRemove` — not the full `FileRecord`
- **`SidebarItemProps`**: `id`, `title`, `isActive`, `onSelect`, `onDelete` — not the full `Conversation`
- **`FileDataContext`**: `fileName`, `columnNames`, `rowCount`, `sampleData` — not the full `FileRecord` with `blobUrl`, `userId`, etc.

### D — Dependency Inversion

High-level modules don't depend on low-level implementations.

- **Route handlers** → depend on `services/*` (abstract operations), not `db.*` (Drizzle calls) directly
- **Services** → return `Result<T, E>` (abstract outcome), not HTTP `Response` objects
- **Components** → consume context interfaces via `use(Context)`, not specific state implementations
- **AI model** → configured via environment, injected at the call site — not hardcoded in business logic
- **File storage** → `blobUrl` stored in DB, actual storage is Vercel Blob — swap to S3/R2 by changing only `services/files.ts`

### React 19 Updates (vs. 2021 article patterns)

| 2021 Pattern                            | React 19 Pattern                                                |
| --------------------------------------- | --------------------------------------------------------------- |
| `React.forwardRef((props, ref) => ...)` | `function Component({ ref, ...props })` — ref is a regular prop |
| `useContext(MyContext)`                 | `use(MyContext)` — can be called conditionally                  |
| `<MyContext.Provider value={...}>`      | `<MyContext value={...}>` — direct JSX context provider         |
| Class-based `ErrorBoundary`             | Still class-based (no hook alternative yet)                     |
| HOCs for cross-cutting concerns         | HOFs for route handlers (`withAuthHandler`), composition for UI |

---

## 19. Key Implementation Notes

### AI SDK v6 Patterns (Verified Against Docs)

- Use `streamText` (not `generateText`) for chat responses — with `tools` for artifact generation
- Use `toUIMessageStreamResponse()` (not `toDataStreamResponse()`)
- Use `maxOutputTokens` (not `maxTokens`)
- Use `stopWhen: stepCountIs(3)` (not `maxSteps: 3`) — import `stepCountIs` from `'ai'`
- Server route must convert messages: `messages: await convertToModelMessages(messages)` — `UIMessage[]` has `parts`, NOT `content`
- Validate only `conversationId` with zod (`chatBodySchema`); messages are `UIMessage[]` validated by `convertToModelMessages()`
- Use `useChat` with manual `useState` for input (managed input is removed)
- `useChat` returns `status` (`'ready' | 'submitted' | 'streaming' | 'error'`), NOT `isLoading` — derive: `status === 'submitted' || status === 'streaming'`
- Use `DefaultChatTransport` from `'ai'` for transport config
- Use `generateText` with `Output.object()` for structured outputs (not `generateObject`)
- Use `tool()` with `inputSchema` (not `parameters`) for tool definitions
- Use `generateText` inside tool `execute()` for multi-model routing (analysis model calls codegen model)
- `UIMessage` has NO `content` field — only `parts` array. Import `UIMessage` from `'ai'`
- Tool parts: `part.type` is `'tool-{toolName}'` (e.g., `'tool-generateArtifact'`), NOT `'tool-invocation'`
- Tool states: `'input-streaming'`, `'input-available'`, `'output-available'`, `'output-error'` — NOT `'partial-call'`, `'call'`, `'result'`
- Tool output: access via `part.output` (NOT `part.result`)
- Model IDs centralized in `AI_MODELS` constant (`types/ai.ts`), not hardcoded in routes

### Drizzle ORM Patterns

- Use `uuid` column type with `$defaultFn(() => uuidv7())` for time-ordered IDs
- Use `timestamp('...', { withTimezone: true })` for all time columns
- Add `index()` on every foreign key column — Postgres does NOT auto-create these
- Use `$type<T>()` for type-safe JSONB columns
- Use `$inferSelect` / `$inferInsert` for exported type helpers
- Use `onConflictDoNothing()` for atomic upserts
- Always use transactions for multi-step writes

### WorkOS AuthKit Patterns (Next.js 16)

- Use `proxy.ts` (not `middleware.ts`) — Next.js 16 convention
- Wrap app in `<AuthKitProvider initialAuth>` in root layout for optimized hydration
- Use `withAuthHandler()` HOF to DRY auth logic across all API routes
- Use `withAuth({ ensureSignedIn: true })` inside the HOF
- Atomic user upsert with `onConflictDoNothing` — no race conditions

### Error Handling

- **Recoverable errors** → returned as `Result<T, E>` values from services
- **Unrecoverable errors** → throw (DB down, network failure) → caught by error boundaries/Next.js
- `errorResponse()` maps `AppError` to HTTP status codes at the API boundary
- Never throw for domain logic — `NotFoundError`, `ValidationError`, `FileError` are values
- All error types are `readonly` interfaces in a discriminated union for exhaustive checking

### Typing Discipline

- All shared types live in `types/` — never inline complex types
- Component props defined as `readonly` interfaces in `types/components.ts`
- API contracts defined as zod schemas (runtime) + TypeScript interfaces (compile-time)
- DB entity types exported from schema via `$inferSelect` / `$inferInsert`
- `as const` for constants (`FILE_LIMITS`, `ALLOWED_FILE_TYPES`)
- Prefer `readonly` on all interface fields to prevent accidental mutation

### Performance (Vercel Best Practices)

- Use parallel `Promise.all()` for independent DB queries (e.g., conversation + file data)
- Use Suspense boundaries for streaming RSC data (sidebar, chat panel)
- Lazy-load Sandpack with `next/dynamic({ ssr: false })` — it's ~2MB
- Import directly from Shadcn component files (avoid barrel imports)
- Store only metadata + sample data in DB; raw files in Vercel Blob
- Derive artifact state via `useMemo` — no `useEffect` for derived state

### Database (PlanetScale Postgres)

- Use PlanetScale's pooled connection URL for serverless compatibility
- PgBouncer handles server-side connection pooling
- All timestamps use `TIMESTAMPTZ` (with timezone)
- UUIDv7 primary keys for index-friendly, time-ordered IDs
- Proper FK indexes on all reference columns

---

## 20. Implementation Order

```
Phase 1 — Foundation
  1. Next.js 16.2.0 project setup + Tailwind v4 + Shadcn
  2. types/ directory: Result, AppError, API schemas, constants
  3. PlanetScale Postgres + Drizzle schema (UUIDv7, timestamptz, indexes) + migrations
  4. WorkOS AuthKit integration (proxy.ts, callback, AuthKitProvider)
  5. withAuthHandler HOF + user sync
  6. services/ stubs returning Result types
  7. Basic three-panel layout with Suspense boundaries + ErrorBoundary

Phase 2 — Core Chat
  8. services/conversations.ts (CRUD, returns Result)
  9. Conversation API routes (all with withAuthHandler + errorResponse)
  10. Sidebar: list/create/delete conversations (SWR)
  11. types/ai.ts (AI_MODELS config, tool input/output types, AnalysisToolOutput)
  12. lib/system-prompt.ts (analysis + codegen prompt builders)
  13. Chat API route: streamText + analyzeData + generateArtifact tools (stopWhen: stepCountIs(3))
  14. Chat UI: useChat hook + MessageBubble (collapsible analysis, artifact card)
  15. services/messages.ts (persistence in transactions + updatedAt)
  16. Auto-title generation (gpt-5.4-nano via services/ai.ts)

Phase 3 — File Upload + Artifacts
  17. services/files.ts (validateFile + parseFileContents → Result)
  18. Vercel Blob setup + file upload API route
  19. File upload UI in chat input + FileUploadBadge (minimal props)
  20. System prompt injection with FileDataContext (both analysis + codegen prompts)
  21. Sandpack integration via lazy-loaded ArtifactPanel (preview/code toggle)
  22. Tool part rendering: analysis collapse + artifact card + skeleton states

Phase 4 — Polish
  23. Error feedback loop (useArtifactErrors → retry via tool re-invocation, MAX_ARTIFACT_RETRIES)
  24. Loading states, empty states, Suspense fallbacks
  25. Responsive layout / mobile considerations
  26. Deploy to Vercel
```
