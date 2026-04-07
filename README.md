# Artifact Agent

> Chat with CSV/Excel data and turn it into interactive React artifacts.

## Overview

A Next.js 16 spreadsheet chat app with a browser-side artifact runtime. Users authenticate, upload a CSV/XLS/XLSX file, ask a question about the data, and receive a streamed assistant response that can inspect the full dataset, generate a multi-file React artifact, and render it live in Sandpack.

Key features:

- Authenticated chat workspace with multiple conversations per user
- CSV/XLS/XLSX upload with file metadata stored in Postgres and blobs stored in Vercel Blob
- Full-dataset analysis tools: `analyzeData`, `readDatasetRows`, and `generateArtifact`
- Streaming chat responses with typed tool/activity parts
- Multi-file React artifact generation rendered in Sandpack with preview/code toggle
- Background artifact validation plus automatic and manual retry flows
- File preview modal for uploaded files
- Downloadable artifact ZIP export with a Vite scaffold and local dataset snapshot

## Tech Stack

| Technology                         | Purpose                                             |
| ---------------------------------- | --------------------------------------------------- |
| Next.js 16 + React 19 + TypeScript | Full-stack app shell, App Router, server components |
| WorkOS AuthKit                     | Authentication and route protection                 |
| Vercel AI SDK 6 + OpenAI provider  | Streaming chat, tool execution, typed UI messages   |
| PostgreSQL + Drizzle ORM           | Persistent storage and schema management            |
| Vercel Blob                        | File storage for uploads and normalized datasets    |
| Papa Parse + SheetJS               | CSV/XLS/XLSX parsing                                |
| Sandpack React                     | In-browser artifact compilation and preview         |
| Tailwind CSS v4                    | Styling                                             |
| JSZip                              | Artifact ZIP export                                 |

## Architecture

At a high level, the authenticated chat UI is a server-rendered shell that hydrates a client `ChatView`. Uploads are parsed on the server, persisted as metadata in Postgres, and mirrored into a normalized dataset blob so the AI tools and generated artifacts can work against the full dataset. Chat responses stream as typed AI SDK UI messages — the frontend renders structured tool output, live agent activity, markdown, and artifact cards without parsing ad-hoc text.

The artifact execution model is explicitly browser-side. Each generated artifact becomes a Sandpack React/TypeScript project with a hidden dataset helper when data is attached. This trades heavier client runtime cost for a much simpler execution story: multi-file React projects render locally, runtime errors are observable in the UI, and the same files can be exported as a standalone ZIP.

### Why Sandpack over alternatives?

- **Plain iframe**: would require building a custom bundling pipeline
- **Web Workers**: cannot render DOM-based React UIs
- **Server sandboxes (e2b-style)**: avoids server execution infrastructure but limits artifacts to browser-compatible JavaScript

## Data Ingestion Pipeline

Uploads go through `POST /api/upload`, which validates type and size, parses with Papa Parse or SheetJS, removes empty rows, and stores the first 20 rows as `sampleData` in Postgres. In parallel, it uploads the original file to Vercel Blob and builds a normalized dataset-envelope JSON blob with every normalized row plus per-column profile data (inferred type, missing counts, distinct counts, min/max, top values).

Enforces a 5 MB file limit and 150-column cap.

## LLM Agent

The chat stream runs through `streamText()` with three tools:

- **`analyzeData`**: loads the full normalized dataset and returns structured summary/insights
- **`readDatasetRows`**: reads exact row slices from the full dataset with size guards
- **`generateArtifact`**: generates a multi-file React artifact

The agent loop is dataset-aware. The analysis prompt includes file metadata, column names, sample rows, and a full dataset profile. The codegen prompt requires artifacts to load the full dataset through a hidden helper file instead of hardcoding prompt samples. Artifact repair is prompt-driven: runtime failures are converted into a structured retry payload and replayed through the same chat endpoint.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL
- WorkOS, OpenAI, and Vercel Blob credentials

### Installation

```bash
git clone https://github.com/pontiggia/artifact-agent.git
cd artifact-agent
pnpm install
```

### Environment Variables

| Name                              | Required |
| --------------------------------- | -------- |
| `WORKOS_API_KEY`                  | Yes      |
| `WORKOS_CLIENT_ID`                | Yes      |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Yes      |
| `WORKOS_COOKIE_PASSWORD`          | Yes      |
| `DATABASE_URL`                    | Yes      |
| `BLOB_READ_WRITE_TOKEN`           | Yes      |
| `OPENAI_API_KEY`                  | Yes      |

### Database Setup

```bash
pnpm exec drizzle-kit migrate
```

### Run

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Project Structure

```
src/
├── actions/          # Server actions for auth + conversations
├── app/              # App Router pages, layouts, route handlers
├── components/
│   ├── artifact/     # Artifact panel, Sandpack host, runtime bridge, export
│   ├── chat/         # ChatView, composer, file preview, pane layout
│   ├── message/      # Assistant/user rendering, markdown, tool sections
│   └── sidebar/      # Conversation list and user card
├── db/               # Drizzle schema and client
├── hooks/            # Chat, upload, artifact, retry, preview, activity hooks
├── lib/
│   ├── artifact/     # Selectors, retry payloads, ZIP export
│   ├── chat/         # Model-message conversion and streaming
│   ├── datasets/     # Dataset envelopes, caching, blob storage
│   ├── tools/        # AI tools and dataset-helper injection
│   └── system-prompt # Prompt assembly
├── services/         # Business logic layer
└── types/            # Shared TypeScript types
```

## Design Decisions

- **Result pattern**: every service function returns `Result<T, E>` — errors as values, not exceptions
- **Typed UI messages**: AI SDK UI-message streams instead of custom SSE parsing — tool invocations, file references, activity updates, and replays are all consistent
- **Browser-side execution**: Sandpack keeps artifact rendering local, observable, and exportable
- **Multi-model routing**: different models for orchestration, analysis, codegen, and titling
- **Blob storage**: large payloads stay out of Postgres

## Known Limitations

- Deleting a conversation doesn't clean up blob objects
- Spreadsheet preview only uses the first worksheet
- No automated tests for the upload → chat → artifact → retry path
- Artifact code isn't visible during streaming generation
- @Sandpack/react package doesnt support latest nextjs and react versions, or ability to install a full custom environment.
