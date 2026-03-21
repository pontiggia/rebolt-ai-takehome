import 'server-only';

import { generateText, Output, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod/v4';
import type { FileDataContext } from '@/types/file';
import { buildCodegenPrompt } from '@/lib/system-prompt';
import { AI_MODELS } from '@/types/ai';
import { loadDatasetEnvelope } from '@/services/datasets';
import { ARTIFACT_DATASET_ERROR_MARKER } from '@/types/chat';

const DATASET_HELPER_PATH = '/src/rebolt-dataset.ts';
const SMALL_DATASET_FULL_READ_LIMIT = 500;
const LARGE_DATASET_ROW_SLICE_LIMIT = 200;
const FULL_READ_CELL_BUDGET = 25_000;

function parseArtifactFilesObject(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate =
    'files' in value && value.files && typeof value.files === 'object' && !Array.isArray(value.files)
      ? value.files
      : value;

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const entries = Object.entries(candidate);
  if (!entries.every((entry) => typeof entry[1] === 'string')) {
    return null;
  }

  return Object.fromEntries(entries) as Record<string, string>;
}

function tryParseFilesJson(text: string): Record<string, string> | null {
  try {
    return parseArtifactFilesObject(JSON.parse(text));
  } catch {
    return null;
  }
}

function extractJsonFence(text: string): string | null {
  const match = /```(?:json)?\s*\n([\s\S]*?)\n```/i.exec(text);
  return match?.[1] ?? null;
}

function extractSingleFileFallback(text: string): Record<string, string> | null {
  const match = /^```(?:tsx|jsx|ts|js|typescript|javascript)\s*\n([\s\S]*?)\n```$/i.exec(text);
  if (!match) {
    return null;
  }

  const code = match[1].trim();
  if (!code) {
    throw new Error('Artifact code block was empty.');
  }

  return { '/src/App.tsx': code };
}

function validateArtifactFiles(
  files: Record<string, string>,
  options: { requiresDatasetHelper: boolean },
): Record<string, string> {
  const entries = Object.entries(files).map(([path, content]) => [path.trim(), content] as const);

  if (entries.length === 0) {
    throw new Error('Code generator output did not include any files.');
  }

  for (const [path, content] of entries) {
    if (!path.startsWith('/src/')) {
      throw new Error(`Invalid artifact file path "${path}". All files must live under /src/.`);
    }

    if (!content.trim()) {
      throw new Error(`Artifact file "${path}" was empty.`);
    }
  }

  const appFile = entries.find(([path]) => path === '/src/App.tsx');
  if (!appFile) {
    throw new Error('Code generator output must include /src/App.tsx.');
  }

  if (options.requiresDatasetHelper && !appFile[1].includes('rebolt-dataset')) {
    throw new Error(
      'Artifact must load the full dataset via "./rebolt-dataset" inside /src/App.tsx instead of hardcoding preview rows.',
    );
  }

  return Object.fromEntries(entries);
}

function parseFilesFromResponse(text: string): Record<string, string> {
  const trimmed = text.trim();

  const jsonCandidates = [trimmed, extractJsonFence(trimmed)].filter((candidate): candidate is string =>
    Boolean(candidate),
  );
  for (const candidate of jsonCandidates) {
    const files = tryParseFilesJson(candidate);
    if (files) {
      return files;
    }
  }

  const singleFile = extractSingleFileFallback(trimmed);
  if (singleFile) {
    return singleFile;
  }

  throw new Error('Code generator output must be a JSON object with a `files` field or a single fenced TSX/JSX file.');
}

function buildDatasetRuntimeHelper(fileData: FileDataContext): string {
  return `import { useEffect, useState } from "react";

export interface DatasetTopValue {
  value: string;
  count: number;
}

export interface DatasetColumnProfile {
  name: string;
  inferredType: "number" | "date" | "boolean" | "string" | "unknown";
  missingCount: number;
  invalidCount: number;
  distinctCount: number;
  sampleValues: string[];
  min: string | number | null;
  max: string | number | null;
  topValues: DatasetTopValue[];
}

export interface DatasetEnvelope {
  fileId: string;
  fileName: string;
  columnNames: string[];
  rowCount: number;
  rows: Record<string, unknown>[];
  profile: {
    columns: DatasetColumnProfile[];
  };
}

const DATASET_URL = ${JSON.stringify(fileData.datasetUrl)};
const ERROR_PREFIX = ${JSON.stringify(ARTIFACT_DATASET_ERROR_MARKER)};

let datasetPromise: Promise<DatasetEnvelope> | null = null;

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim().length > 0 ? text : response.statusText;
  } catch {
    return response.statusText || "Unknown dataset fetch error";
  }
}

async function fetchDataset(): Promise<DatasetEnvelope> {
  const response = await fetch(DATASET_URL);
  if (!response.ok) {
    throw new Error(\`\${ERROR_PREFIX} \${await readErrorMessage(response)}\`);
  }

  return response.json() as Promise<DatasetEnvelope>;
}

export function loadDataset(): Promise<DatasetEnvelope> {
  if (!datasetPromise) {
    datasetPromise = fetchDataset();
  }

  return datasetPromise;
}

export function useDataset(): {
  dataset: DatasetEnvelope | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
} {
  const [dataset, setDataset] = useState<DatasetEnvelope | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    loadDataset()
      .then((nextDataset) => {
        if (cancelled) {
          return;
        }

        setDataset(nextDataset);
        setError(null);
        setIsLoading(false);
      })
      .catch((nextError: unknown) => {
        if (cancelled) {
          return;
        }

        setDataset(null);
        setError(nextError instanceof Error ? nextError : new Error(\`\${ERROR_PREFIX} Failed to load dataset.\`));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    dataset,
    isLoading,
    error,
    reload: async () => {
      datasetPromise = fetchDataset();
      const nextDataset = await datasetPromise;
      setDataset(nextDataset);
      setError(null);
      setIsLoading(false);
    },
  };
}
`;
}

function injectDatasetRuntimeHelper(
  files: Record<string, string>,
  fileData: FileDataContext | null,
): Record<string, string> {
  if (!fileData) {
    return files;
  }

  return {
    ...files,
    [DATASET_HELPER_PATH]: buildDatasetRuntimeHelper(fileData),
  };
}

function pickSelectedColumns(fileData: FileDataContext, requestedColumns: readonly string[]): readonly string[] {
  const validColumns = requestedColumns.filter((column) => fileData.columnNames.includes(column));
  return validColumns.length > 0 ? validColumns : fileData.columnNames;
}

function computeMaxReadableRows(totalRows: number, columnCount: number): number {
  if (totalRows <= SMALL_DATASET_FULL_READ_LIMIT && totalRows * Math.max(1, columnCount) <= FULL_READ_CELL_BUDGET) {
    return totalRows;
  }

  return LARGE_DATASET_ROW_SLICE_LIMIT;
}

export function createChatTools(fileData: FileDataContext | null) {
  return {
    analyzeData: tool({
      description:
        'Analyze the FULL uploaded dataset to understand its structure, detect patterns, and determine the best way to represent it. Call this before generateArtifact when exact stats or schema understanding matters.',
      inputSchema: z.object({
        task: z
          .string()
          .describe(
            'What to analyze: e.g., "understand the structure of this leave tracker", "find trends in sales over time"',
          ),
        columns: z.array(z.string()).describe('Which columns to focus the analysis on'),
      }),
      execute: async ({ task, columns }) => {
        if (!fileData) {
          return {
            summary: 'No file data is available yet.',
            insights: [],
            suggestedApproach: 'Ask the user to upload a CSV or Excel file first.',
            sampleValues: [],
          };
        }

        const envelope = await loadDatasetEnvelope(fileData.fileId, fileData.datasetUrl);
        const selectedColumns = pickSelectedColumns(fileData, columns);
        const selectedProfiles = envelope.profile.columns.filter((profile) => selectedColumns.includes(profile.name));
        const sampleValues = envelope.rows
          .slice(0, 10)
          .map((row) => Object.fromEntries(selectedColumns.map((column) => [column, row[column]])));

        const result = await generateText({
          model: openai(AI_MODELS.title),
          output: Output.object({
            schema: z.object({
              summary: z.string().describe('Brief summary of the full-dataset analysis'),
              insights: z.array(z.string()).describe('Key patterns, trends, or notable findings'),
              suggestedApproach: z.string().describe('Recommended visualization or UI approach'),
            }),
          }),
          prompt: `Analyze this FULL dataset for the task: "${task}"
Focused columns: ${selectedColumns.join(', ')}
Exact file metadata:
${JSON.stringify(
  {
    fileName: envelope.fileName,
    rowCount: envelope.rowCount,
    columnNames: envelope.columnNames,
    selectedProfiles,
  },
  null,
  2,
)}

Sample rows from the FULL dataset:
${JSON.stringify(sampleValues, null, 2)}

Provide:
1. A concise summary of what the full dataset contains
2. 2-4 specific insights grounded in the exact stats above
3. A recommended approach for visualizing or representing this data`,
        });

        return {
          summary: result.output?.summary ?? `Analyzed ${selectedColumns.join(', ')} for: ${task}`,
          insights: result.output?.insights ?? [],
          suggestedApproach: result.output?.suggestedApproach ?? '',
          sampleValues,
        };
      },
    }),

    readDatasetRows: tool({
      description:
        'Read exact rows from the FULL uploaded dataset. Use this when you need exact row values before generating an artifact, especially for small datasets or targeted slices.',
      inputSchema: z.object({
        offset: z.number().int().min(0).default(0).describe('Zero-based row offset'),
        limit: z.number().int().min(1).max(500).default(50).describe('How many rows to read'),
        columns: z.array(z.string()).optional().describe('Optional subset of columns to return'),
      }),
      execute: async ({ offset, limit, columns }) => {
        if (!fileData) {
          return {
            rows: [],
            totalRows: 0,
            offset: 0,
            count: 0,
            hasMore: false,
            columns: [],
          };
        }

        const envelope = await loadDatasetEnvelope(fileData.fileId, fileData.datasetUrl);
        const selectedColumns = pickSelectedColumns(fileData, columns ?? []);
        const maxReadableRows = computeMaxReadableRows(envelope.rowCount, selectedColumns.length);
        const safeOffset = Math.max(0, offset);
        const safeLimit = Math.max(1, Math.min(limit, maxReadableRows));
        const rows = envelope.rows
          .slice(safeOffset, safeOffset + safeLimit)
          .map((row) => Object.fromEntries(selectedColumns.map((column) => [column, row[column]])));

        return {
          rows,
          totalRows: envelope.rowCount,
          offset: safeOffset,
          count: rows.length,
          hasMore: safeOffset + rows.length < envelope.rowCount,
          columns: selectedColumns,
        };
      },
    }),

    generateArtifact: tool({
      description:
        'Generate a self-contained React component that transforms the uploaded spreadsheet into an interactive UI. The generated artifact must load the FULL dataset at runtime via ./rebolt-dataset rather than hardcoding sampled rows.',
      inputSchema: z.object({
        title: z.string().describe('Artifact title shown in the UI header'),
        description: z
          .string()
          .describe(
            'Detailed description of what to build. Be specific about the type of UI, which columns to use, how to organize/group the data, what interactions to support, and the overall layout.',
          ),
      }),
      execute: async ({ title, description }) => {
        const { text } = await generateText({
          model: openai(AI_MODELS.codegen),
          system: buildCodegenPrompt(fileData),
          prompt: `Title: "${title}"\n\nDescription: ${description}`,
          maxOutputTokens: 16384,
        });

        const parsedFiles = parseFilesFromResponse(text);
        const validatedFiles = validateArtifactFiles(parsedFiles, {
          requiresDatasetHelper: Boolean(fileData),
        });
        const files = injectDatasetRuntimeHelper(validatedFiles, fileData);

        return { title, fileId: fileData?.fileId ?? null, files };
      },
    }),
  };
}
