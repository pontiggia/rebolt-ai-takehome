import 'server-only';

import { ARTIFACT_CODEGEN_PACKAGES, ARTIFACT_RUNTIME_VERSION_SUMMARY } from '@/lib/artifact-runtime';
import type { ArtifactRetryPayload } from '@/types/chat';
import type { FileDataContext } from '@/types/file';

const ANALYSIS_PREVIEW_ROW_COUNT = 20;

interface DatasetPromptContext {
  readonly fileName: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly sampleRowCount: number;
  readonly sampledRows: readonly Record<string, unknown>[];
  readonly previewRows: readonly Record<string, unknown>[];
}

export interface ArtifactRetryDataContext {
  readonly fileName: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly sampleRowCount: number;
}

function createDatasetPromptContext(fileData: FileDataContext | null): DatasetPromptContext | null {
  if (!fileData) {
    return null;
  }

  return {
    fileName: fileData.fileName,
    columnNames: fileData.columnNames,
    rowCount: fileData.rowCount,
    sampleRowCount: fileData.sampleData.length,
    sampledRows: fileData.sampleData,
    previewRows: fileData.sampleData.slice(0, ANALYSIS_PREVIEW_ROW_COUNT),
  };
}

function formatColumns(columnNames: readonly string[]): string {
  return columnNames.length > 0 ? columnNames.join(', ') : 'No columns detected';
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildAnalysisDataContext(dataContext: DatasetPromptContext | null): string {
  if (!dataContext) {
    return 'No file has been uploaded yet.';
  }

  return `
## Available Data
- File: "${dataContext.fileName}"
- Columns: ${formatColumns(dataContext.columnNames)}
- Total dataset rows: ${dataContext.rowCount}
- Stored sampled rows available to tools/codegen: ${dataContext.sampleRowCount}
- Preview shown below: first ${dataContext.previewRows.length} sampled row${dataContext.previewRows.length === 1 ? '' : 's'}
\`\`\`json
${formatJson(dataContext.previewRows)}
\`\`\`
`;
}

function buildCodegenDataContext(dataContext: DatasetPromptContext | null): string {
  if (!dataContext) {
    return 'No data available.';
  }

  return `- File: "${dataContext.fileName}"
- Columns: ${formatColumns(dataContext.columnNames)}
- Total rows: ${dataContext.rowCount}
- Sampled rows available in this prompt: ${dataContext.sampleRowCount}
- Sample data:
\`\`\`json
${formatJson(dataContext.sampledRows)}
\`\`\``;
}

function buildDataFileInstruction(dataContext: DatasetPromptContext | null): string {
  if (!dataContext) {
    return '- `/src/data.ts` is required. Export the dataset as `export const DATA = []`.';
  }

  const coverageInstruction =
    dataContext.rowCount > dataContext.sampleRowCount
      ? `The uploaded file has ${dataContext.rowCount} total rows, but only ${dataContext.sampleRowCount} sampled rows are available here, so the artifact must behave like a preview built from the sampled rows in this prompt.`
      : `All ${dataContext.rowCount} row${dataContext.rowCount === 1 ? '' : 's'} from the uploaded dataset are available in this prompt.`;

  return `- \`/src/data.ts\` is required. Export the dataset as \`export const DATA = [...]\`.
- Export exactly the sampled rows provided in this prompt (${dataContext.sampleRowCount} row${dataContext.sampleRowCount === 1 ? '' : 's'}). Do not invent, extrapolate, or synthesize unseen rows.
- ${coverageInstruction}`;
}

function buildRetrySchemaSummary(dataContext: ArtifactRetryDataContext | null): string {
  if (!dataContext) {
    return '- No uploaded dataset is attached to this conversation.';
  }

  return `- File: "${dataContext.fileName}"
- Columns: ${formatColumns(dataContext.columnNames)}
- Total rows: ${dataContext.rowCount}
- Sampled rows available to code generation: ${dataContext.sampleRowCount}`;
}

export function buildAnalysisPrompt(fileData: FileDataContext | null): string {
  const dataContext = buildAnalysisDataContext(createDatasetPromptContext(fileData));

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

## Description Quality

The \`description\` field in generateArtifact drives the code generator. Keep it focused:
- Describe **what** to show and **why** it matters — not how to lay it out.
- Mention which columns to use and what the visualization should communicate.
- Do NOT prescribe specific UI components, grid layouts, filter widgets, or interactions unless the user explicitly asked for them. Let the code generator make design decisions.
- Less is more. A dashboard with 2 clear charts beats one with 6 cramped panels. Only include what directly serves the user's question.

## Error Correction

If the user or system reports an error in the artifact, analyze the error message and call generateArtifact again with a corrected description. Include the error details in the description field so the code generator can fix the issue, and keep the original user goal intact.

Always double-check column names against the available data before calling any tool.`;
}

export function buildCodegenPrompt(fileData: FileDataContext | null): string {
  const dataContext = createDatasetPromptContext(fileData);

  return `You are a code generator that produces multi-file React projects. You can build ANY type of UI: charts, dashboards, data tables, trackers, calendars, forms, kanban boards, stat card layouts, or any combination.

## Available Data
${buildCodegenDataContext(dataContext)}

## Output Format

You MUST output a single JSON object with a \`files\` field. Each key is a file path starting with \`/src/\`, each value is the raw file content as a string. Output ONLY the JSON — no markdown fences, no explanation, no text before or after.

Example output format:
\`\`\`
{"files":{"/src/App.tsx":"import React from 'react';\\nexport default function App() { return <div>Hello</div>; }","/src/data.ts":"export const DATA = [];"}}
\`\`\`

## Project Constraints

- \`/src/App.tsx\` is required. It MUST have \`export default\` — this is the entry point.
${buildDataFileInstruction(dataContext)}
- All file paths MUST start with \`/src/\`. Do NOT create \`/index.tsx\` — provided by the environment.
- Use relative imports between files.
- Runtime versions are pinned to ${ARTIFACT_RUNTIME_VERSION_SUMMARY}.
- Available npm packages: \`${ARTIFACT_CODEGEN_PACKAGES.join('`, `')}\`. No others.
- **Tailwind CSS** is available via CDN. Use utility classes for all styling. Do not use inline styles.
- For charts: always wrap in \`<ResponsiveContainer width="100%" height={...}>\`. Never set a fixed pixel width.
- For tables: wrap in an \`overflow-x-auto\` container to prevent horizontal overflow.
- Use TypeScript/TSX for all files.

## Design

You are a frontend designer. Build polished, minimal UIs — not prototypes.

- **Less is more.** Show only what matters. Prefer whitespace over density. A few well-designed elements beat many cramped ones.
- Do not add filters, search inputs, date pickers, or interactive controls unless the user explicitly asked for them.
- Match the visual style to the user's request.
- Ensure nothing overflows or clips. Give charts enough vertical space for labels and legends.`;
}

export function buildArtifactRetryMessage(
  retry: ArtifactRetryPayload,
  originalUserRequest: string | null,
  dataContext: ArtifactRetryDataContext | null,
): string {
  const filesSection = retry.files
    ? `
## Previous Files
\`\`\`json
${formatJson(retry.files)}
\`\`\`
`
    : '';

  return `The last artifact generation needs an immediate ${retry.manual ? 'manual' : 'automatic'} retry.

## Original User Request
${originalUserRequest?.trim() || 'No original user request text was recovered from the current conversation.'}

## Data Schema Summary
${buildRetrySchemaSummary(dataContext)}

## Previous Artifact
- Title: ${retry.artifactTitle ?? 'Untitled artifact'}
- Description: ${retry.artifactDescription ?? 'No previous description available.'}

## Retry Attempt
- Attempt: ${retry.attempt}
- Source: ${retry.source}

## Exact Error
${retry.error}
${filesSection}

Keep the original user request intact, stay aligned with the available schema, and fix the failure by calling generateArtifact again with corrected instructions. Do not answer with text-only unless generating an artifact is impossible.`;
}
