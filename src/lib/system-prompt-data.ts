import type { DatasetColumnProfile, FileDataContext } from '@/types/file';

const ANALYSIS_PREVIEW_ROW_COUNT = 20;

interface DatasetPromptContext {
  readonly fileId: string;
  readonly fileName: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly sampleRowCount: number;
  readonly sampledRows: readonly Record<string, unknown>[];
  readonly previewRows: readonly Record<string, unknown>[];
  readonly datasetProfile: FileDataContext['datasetProfile'];
}

export interface ArtifactRetryDataContext {
  readonly fileId: string;
  readonly fileName: string;
  readonly columnNames: readonly string[];
  readonly rowCount: number;
  readonly sampleRowCount: number;
}

export function createDatasetPromptContext(fileData: FileDataContext | null): DatasetPromptContext | null {
  if (!fileData) {
    return null;
  }

  return {
    fileId: fileData.fileId,
    fileName: fileData.fileName,
    columnNames: fileData.columnNames,
    rowCount: fileData.rowCount,
    sampleRowCount: fileData.sampleData.length,
    sampledRows: fileData.sampleData,
    previewRows: fileData.sampleData.slice(0, ANALYSIS_PREVIEW_ROW_COUNT),
    datasetProfile: fileData.datasetProfile,
  };
}

function formatColumns(columnNames: readonly string[]): string {
  return columnNames.length > 0 ? columnNames.join(', ') : 'No columns detected';
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatProfileLine(profile: DatasetColumnProfile): string {
  const parts = [
    `${profile.name}: type=${profile.inferredType}`,
    `missing=${profile.missingCount}`,
    `invalid=${profile.invalidCount}`,
    `distinct=${profile.distinctCount}`,
  ];

  if (profile.min !== null) {
    parts.push(`min=${profile.min}`);
  }

  if (profile.max !== null) {
    parts.push(`max=${profile.max}`);
  }

  if (profile.sampleValues.length > 0) {
    parts.push(`samples=${profile.sampleValues.join(' | ')}`);
  }

  return `- ${parts.join(', ')}`;
}

function buildProfileSummary(dataContext: DatasetPromptContext): string {
  const profiles = dataContext.datasetProfile.columns;
  if (profiles.length === 0) {
    return '- No column profile available.';
  }

  return profiles.map((profile) => formatProfileLine(profile)).join('\n');
}

export function buildAnalysisDataContext(dataContext: DatasetPromptContext | null): string {
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
- Full dataset profile:
${buildProfileSummary(dataContext)}
\`\`\`json
${formatJson(dataContext.previewRows)}
\`\`\`
`;
}

export function buildCodegenDataContext(dataContext: DatasetPromptContext | null): string {
  if (!dataContext) {
    return 'No data available.';
  }

  return `- File: "${dataContext.fileName}"
- Columns: ${formatColumns(dataContext.columnNames)}
- Total rows: ${dataContext.rowCount}
- Sampled rows available in this prompt: ${dataContext.sampleRowCount}
- Full dataset profile:
${buildProfileSummary(dataContext)}
- Sample data:
\`\`\`json
${formatJson(dataContext.sampledRows)}
\`\`\``;
}

export function buildDatasetRuntimeInstruction(dataContext: DatasetPromptContext | null): string {
  if (!dataContext) {
    return '- No uploaded dataset is attached. Build the artifact without assuming any external data source.';
  }

  return `- A hidden helper file already exists at \`/src/rebolt-dataset.ts\`.
- In \`/src/App.tsx\`, import \`useDataset\`, \`loadDataset\`, \`getProfileMap\`, or \`getColumnProfile\` from \`"./rebolt-dataset"\`. This helper is the ONLY source of truth for the full uploaded dataset.
- \`useDataset()\` returns \`{ dataset, isLoading, error, reload }\`.
- \`dataset\` has \`fileId\`, \`fileName\`, \`rowCount\`, \`columnNames\`, \`rows\`, and \`profile\`.
- Use \`getProfileMap(dataset)\` or \`getColumnProfile(dataset, columnName)\` if you need column profile access. Do NOT assume \`dataset.profile\` is keyed by column name.
- Use \`dataset.rows\` for charts, summaries, totals, filters, and tables. Do NOT inline raw data, do NOT create \`/src/data.ts\`, and do NOT pretend the preview sample in this prompt is the full dataset.
- If you build a raw table for a large dataset, paginate the rendered rows client-side so the DOM stays manageable.`;
}

export function buildOpenAIProxyRuntimeInstruction(useReboltAI: boolean): string {
  if (!useReboltAI) {
    return '- No Rebolt OpenAI proxy runtime is attached for this artifact. Keep the project fully browser-only and do not call any backend or model endpoint.';
  }

  return `- A hidden runtime shim already exists at \`/src/rebolt-openai-proxy.ts\`, and it will be auto-loaded before \`/src/App.tsx\` runs.
- When the artifact needs live model output, call \`fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4.1", ... }) })\`.
- Do NOT add \`Authorization\`, API-key, organization, or project headers in artifact code. Rebolt injects OpenAI auth server-side.
- Only the OpenAI Responses API is supported for proxy-backed artifact inference. Do NOT call other provider endpoints or any backend route directly.
- Keep inference payloads compact. Use \`dataset.profile\`, aggregate stats, derived features, and at most a tiny representative sample. Never send hundreds or thousands of raw dataset rows to the model.
- Generated copy must stay truthful: describe outputs as LLM-backed forecasts or estimates, not as trained XGBoost/random-forest models or benchmarked metrics unless the prompt explicitly provides them.`;
}

export function buildRetrySchemaSummary(dataContext: ArtifactRetryDataContext | null): string {
  if (!dataContext) {
    return '- No uploaded dataset is attached to this conversation.';
  }

  return `- File: "${dataContext.fileName}"
- Columns: ${formatColumns(dataContext.columnNames)}
- Total rows: ${dataContext.rowCount}
- Sampled rows available to code generation: ${dataContext.sampleRowCount}`;
}
