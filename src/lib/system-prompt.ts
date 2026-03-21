import 'server-only';

import { ARTIFACT_CODEGEN_PACKAGES, ARTIFACT_RUNTIME_VERSION_SUMMARY } from '@/lib/artifact-runtime';
import {
  buildAnalysisDataContext,
  buildCodegenDataContext,
  buildDatasetRuntimeInstruction,
  buildRetrySchemaSummary,
  createDatasetPromptContext,
  formatJson,
} from '@/lib/system-prompt-data';
import type { ArtifactRetryDataContext } from '@/lib/system-prompt-data';
import {
  ANALYSIS_DESCRIPTION_QUALITY_SECTION,
  ANALYSIS_ERROR_CORRECTION_SECTION,
  ANALYSIS_ROLE_SECTION,
  ANALYSIS_TOOL_CHAIN_SECTION,
  CODEGEN_DESIGN_SECTION,
  CODEGEN_OUTPUT_FORMAT_SECTION,
} from '@/lib/system-prompt-sections';
import type { ArtifactRetryPayload } from '@/types/chat';
import type { FileDataContext } from '@/types/file';

export type { ArtifactRetryDataContext } from '@/lib/system-prompt-data';

export function buildAnalysisPrompt(fileData: FileDataContext | null): string {
  const dataContext = buildAnalysisDataContext(createDatasetPromptContext(fileData));

  return `You are a data analysis assistant. Users upload CSV/Excel files and ask questions about them. You can generate **any kind of interactive React component** — not just charts. Think broadly: dashboards, trackers, calendars, data tables, forms, stat cards, kanban boards, or any combination that best represents the data.

${dataContext}

${ANALYSIS_ROLE_SECTION}

${ANALYSIS_TOOL_CHAIN_SECTION}

${ANALYSIS_DESCRIPTION_QUALITY_SECTION}

${ANALYSIS_ERROR_CORRECTION_SECTION}`;
}

export function buildCodegenPrompt(fileData: FileDataContext | null): string {
  const dataContext = createDatasetPromptContext(fileData);

  return `You are a code generator that produces multi-file React projects. You can build ANY type of UI: charts, dashboards, data tables, trackers, calendars, forms, kanban boards, stat card layouts, or any combination.

## Available Data
${buildCodegenDataContext(dataContext)}

${CODEGEN_OUTPUT_FORMAT_SECTION}

## Project Constraints

- \`/src/App.tsx\` is required. It MUST have \`export default\` — this is the entry point.
${buildDatasetRuntimeInstruction(dataContext)}
- All file paths MUST start with \`/src/\`. Do NOT create \`/index.tsx\` — provided by the environment.
- Use relative imports between files.
- Runtime versions are pinned to ${ARTIFACT_RUNTIME_VERSION_SUMMARY}.
- Available npm packages: \`${ARTIFACT_CODEGEN_PACKAGES.join('`, `')}\`. No others.
- **Tailwind CSS** is available via CDN. Use utility classes for all styling. Do not use inline styles.
- For charts: always wrap in \`<ResponsiveContainer width="100%" height={...}>\`. Never set a fixed pixel width.
- For tables: wrap in an \`overflow-x-auto\` container to prevent horizontal overflow.
- Use TypeScript/TSX for all files.

${CODEGEN_DESIGN_SECTION}`;
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
