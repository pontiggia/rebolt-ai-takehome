# Rebolt take home

> Chat with CSV/Excel data and turn it into interactive React artifacts.

<!-- Add a screenshot or short GIF of the chat workspace and artifact pane here. -->

## Overview

This project is a Next.js 16 spreadsheet chat app with a browser-side artifact runtime. Users authenticate, upload a CSV/XLS/XLSX file, ask a question about the data, and receive a streamed assistant response that can inspect the full dataset, generate a multi-file React artifact, and render that artifact live in Sandpack.

Key working features:

- WorkOS-backed authenticated chat workspace with multiple conversations per user
- CSV/XLS/XLSX upload with file metadata stored in Postgres and blobs stored in Vercel Blob
- Full-dataset analysis tools: `analyzeData`, `readDatasetRows`, and `generateArtifact`
- Streaming chat responses with typed tool/activity parts
- Multi-file React artifact generation rendered in Sandpack with preview/code toggle
- Background artifact validation plus automatic and manual retry flows
- File preview modal for uploaded files
- Downloadable artifact ZIP export with a Vite scaffold and local dataset snapshot

## Tech Stack

| Technology                                          | Purpose                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| Next.js 16.2.0 + React 19.2.4 + TypeScript          | Full-stack app shell, App Router, server components, and typed client UI |
| WorkOS AuthKit                                      | Authentication, callback handling, and route protection                  |
| Vercel AI SDK 6 + OpenAI provider                   | Streaming chat, tool execution, typed UI messages, and model calls       |
| PostgreSQL + `pg`                                   | Persistent storage for users, conversations, messages, and file metadata |
| Drizzle ORM + drizzle-kit                           | Schema definition, queries, and SQL migrations                           |
| Vercel Blob                                         | Original upload storage and normalized dataset-envelope storage          |
| Papa Parse + SheetJS (`xlsx`)                       | CSV/XLS/XLSX parsing and spreadsheet preview extraction                  |
| Sandpack React                                      | In-browser artifact compilation, preview, and code inspection            |
| Tailwind CSS v4                                     | Application styling                                                      |
| Base UI Dialog + Lucide                             | Modal primitives and icons                                               |
| `react-markdown` + `remark-gfm` + `rehype-sanitize` | Safe assistant markdown rendering                                        |
| JSZip                                               | Exporting generated artifacts as ZIP archives                            |

## Architecture

(![Architecture Diagram](./architecture.png))

At a high level, the authenticated chat UI is a server-rendered shell that hydrates a client `ChatView`. Uploads are parsed on the server, persisted as metadata in Postgres, and mirrored into a normalized dataset blob so the AI tools and generated artifacts can work against the full dataset. Chat responses stream as typed AI SDK UI messages, which means the frontend renders structured tool output, live agent activity, markdown, and artifact cards without parsing ad-hoc text.

The artifact execution model is explicitly browser-side. Each generated artifact becomes a Sandpack React/TypeScript project with a hidden `/src/rebolt-dataset.ts` helper when data is attached. That choice trades heavier client runtime cost for a much simpler execution story: multi-file React projects render locally, runtime errors are observable in the UI, and the same files can be exported as a standalone ZIP. Compared with plain iframes, this avoids building a custom bundling pipeline; compared with Web Workers, it can render DOM-based React UIs; compared with server sandboxes such as e2b-style environments, it avoids server execution infrastructure but limits artifacts to browser-compatible JavaScript.

## Getting Started

### Prerequisites

- Node.js: this repository does **not** pin an exact version via `package.json#engines`, `.nvmrc`, or `.node-version`. Start with a current Node 20+ release.
- pnpm: `pnpm-lock.yaml` and `pnpm-workspace.yaml` are present, and the commands below assume pnpm.
- PostgreSQL database reachable through `DATABASE_URL`
- External service credentials for:
  - WorkOS AuthKit
  - OpenAI
  - Vercel Blob

### Installation

```bash
git clone https://github.com/pontiggia/rebolt-ai-takehome.git
cd rebolt-ai-takehome
pnpm install
```

### Environment Variables

| Name                              | Required? | Example value                                             |
| --------------------------------- | --------- | --------------------------------------------------------- |
| `WORKOS_API_KEY`                  | Yes       | `sk-...`                                                  |
| `WORKOS_CLIENT_ID`                | Yes       | `client_...`                                              |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Yes       | `http://localhost:3000/auth/callback`                     |
| `WORKOS_COOKIE_PASSWORD`          | Yes       | `super-long-random-secret-value-123456`                   |
| `DATABASE_URL`                    | Yes       | `postgresql://postgres:postgres@localhost:5432/rebolt_ai` |
| `BLOB_READ_WRITE_TOKEN`           | Yes       | `vercel_blob_rw_...`                                      |
| `OPENAI_API_KEY`                  | Yes       | `sk-...`                                                  |

### Database Setup

This repo does not automate PostgreSQL provisioning, so database creation happens outside the project. Once you have a database and `DATABASE_URL` set:

```bash
pnpm exec drizzle-kit migrate
```

That applies the SQL files in `./drizzle/` using `drizzle.config.ts`.

### Running Locally

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Usage

1. Open `http://localhost:3000` and click **Get started**.
2. Authenticate through the WorkOS flow with Google OAUTH and land in `/chat`.
3. Upload a CSV/XLS/XLSX file from the composer. If you have not started a conversation yet, the app creates one first.
4. Ask a question or request an artifact. Clear requests that mention the relevant columns work best, but open-ended prompts like “analyze this and show me something useful” also map cleanly onto the current tool chain.
5. Watch the assistant stream its response. You may see live activity, collapsible analysis output, dataset-inspection summaries, and an artifact card.
6. Click the artifact card to open the artifact pane. Use the preview/code toggle to inspect the generated project.
7. If the artifact fails at runtime, wait for the automatic retry loop or use the manual retry button after exhaustion.
8. Click any uploaded-file chip to open the file preview modal.
9. Use **Download ZIP** in the artifact panel to export the generated project.

## System Design

### Data Ingestion Pipeline

Uploads go through `POST /api/upload`, which accepts a `conversationId` plus a single `File`. The server validates type and size, parses the file with Papa Parse or SheetJS, removes empty rows, and stores the first 20 rows as `sampleData` in Postgres. In parallel, it uploads the original file to Vercel Blob and builds a normalized dataset-envelope JSON blob under `datasets/<fileId>.json`. That dataset envelope includes every normalized row plus per-column profile data such as inferred type, missing counts, distinct counts, min/max values, and top values.

The ingestion pipeline currently enforces a 5 MB file limit and a 150-column cap. A `maxRows` constant exists in `src/types/file.ts`, but it is not enforced in the upload path today. The upload response includes a five-row preview and a `truncated` flag, but with the current parser implementation that flag remains `false`.

### LLM Agent

The main chat stream runs through `streamText()` with `gpt-4.1`. It has access to three tools:

- `analyzeData`: loads the full normalized dataset and returns structured summary/insights using `gpt-5.4-nano`
- `readDatasetRows`: reads exact row slices from the full dataset with size guards
- `generateArtifact`: calls `gpt-5.4-mini` to generate a multi-file React artifact

The agent loop is dataset-aware. The analysis prompt includes file metadata, column names, sample rows, and a full dataset profile. The codegen prompt requires artifacts to load the full dataset through a hidden helper file instead of hardcoding prompt samples. Artifact repair is also prompt-driven: runtime and tool failures are converted into a structured `artifactRetry` payload, appended as a synthetic user message, and replayed through the same chat endpoint.

Streaming is implemented with the AI SDK UI-message stream APIs. The server validates incoming UI messages with `safeValidateUIMessages()`, converts them to model messages, and returns `createUIMessageStreamResponse({ stream: createChatUIStream(...) })`. On the frontend, the chat renders typed message parts rather than parsing plain text, so tool output, live agent activity, markdown, and artifacts all share the same transport.

### Artifact Rendering

Artifacts are rendered in Sandpack as React/TypeScript projects. The runtime injects a hidden `/index.tsx` entry file and, when a dataset is attached, a hidden `/src/rebolt-dataset.ts` helper that exposes `loadDataset()` and `useDataset()`. The artifact pane offers two views: live preview and read-only code exploration.

The app validates new artifacts before asking the user to trust them. A hidden off-screen Sandpack instance compiles/renders the artifact and emits `ready`, `runtime-error`, `notification-error`, or `timeout` events through `ArtifactSandpackRuntimeBridge`. Those events feed the retry system, which attempts up to three automatic fixes before surfacing a manual retry button. Compared with alternatives, this keeps everything local to the browser and makes runtime errors observable, but it also means artifacts are limited to browser-compatible dependencies and the client pays the Sandpack bundle cost.

### Multi-Conversation Support

Conversations are stored in Postgres and loaded server-side in `src/app/chat/layout.tsx`. The sidebar lists all conversations for the current user, supports deletion through a server action, and resets to `/chat` when the active conversation is deleted. Titles are generated from the first user message with `gpt-5.4-nano`.

Messages are stored as both extracted text and full AI SDK `parts` JSON. That matters because the UI replays historical assistant tool calls, artifact cards, and uploaded-file references directly from persisted message parts. Existing conversations whose latest persisted message is still a user message automatically trigger assistant generation on load.

## Design Decisions & Tradeoffs

- Artifact execution: the codebase chooses Sandpack because artifacts are multi-file React projects that need browser rendering, dependency support, and observable runtime errors. A plain iframe would require custom bundling; a Web Worker could not render the UI; a server sandbox would add infrastructure but is not used here.
- Database choice: PostgreSQL plus Drizzle fits the relational user/conversation/message/file model while still allowing JSONB storage for AI message parts and file metadata.
- File storage: original uploads and normalized dataset envelopes are stored in Vercel Blob instead of the database. That keeps large payloads out of Postgres and lets generated artifacts fetch the same normalized dataset directly.
- LLM provider: all model calls go through the Vercel AI SDK with the OpenAI provider. That gives the app one streaming/runtime abstraction while still allowing different models for orchestration, analysis, codegen, and titling.
- Streaming format: the app uses typed UI-message streams instead of custom SSE text parsing. That makes tool invocations, uploaded-file references, activity updates, and persisted replays consistent.
- Auth: WorkOS AuthKit handles redirects, callback flow, and client/server auth hydration.

## AI Tools Used

The executable source does **not** contain trustworthy evidence of which coding assistants or copilots were used during development, so this README does not invent a provenance story.

The AI tools that are verifiable from the product code itself are:

- Vercel AI SDK 6: chat streaming, tool execution, typed UI messages, `useChat`, and request transport
- OpenAI models: `gpt-4.1` for the main assistant, `gpt-5.4-mini` for artifact code generation, and `gpt-5.4-nano` for title generation and structured dataset analysis

## Project Structure

```text
.
├── drizzle.config.ts
├── drizzle/                         # SQL migrations
├── src/
│   ├── actions/                     # Server actions for auth + conversations
│   ├── app/                         # App Router pages, layouts, and route handlers
│   ├── components/
│   │   ├── artifact/                # Artifact panel, Sandpack host, runtime bridge, export button
│   │   ├── chat/                    # ChatView, composer, file preview, pane layout
│   │   ├── message/                 # Assistant/user rendering, markdown, tool sections
│   │   └── sidebar/                 # Conversation list and user card
│   ├── db/                          # Drizzle schema and client
│   ├── hooks/                       # Chat, upload, artifact, retry, preview, activity hooks
│   ├── lib/
│   │   ├── artifact/                # Artifact selectors, retry payloads, ZIP export
│   │   ├── chat/                    # Model-message conversion and streaming glue
│   │   ├── datasets/                # Dataset envelopes, caching, blob storage
│   │   ├── tools/                   # AI tools and dataset-helper injection
│   │   ├── api.ts                   # Authenticated route wrapper + JSON parsing
│   │   ├── auth.ts                  # Current-user lookup + DB upsert
│   │   └── system-prompt*.ts        # Prompt assembly
│   ├── services/                    # Conversations, uploads, files, datasets, messages, AI
│   ├── types/                       # Shared DTOs and AI/runtime types
│   └── proxy.ts                     # WorkOS redirect logic
├── package.json
└── pnpm-lock.yaml
```

## Known Limitations

- Deleting a conversation removes database rows but does not delete the underlying blob objects.
- Spreadsheet preview only uses the first worksheet and only returns an excerpt, not a full workbook view.
- There are no automated tests or smoke scripts for the upload → chat → artifact → retry path.
- You cannot see the code of the artifacts streamed as its generated.
- On safari web browser the artifact panel has a adjustable/sizable limit.
