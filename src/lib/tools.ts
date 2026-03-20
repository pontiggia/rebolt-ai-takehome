import 'server-only';

import { generateText, Output, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod/v4';
import type { FileDataContext } from '@/types/file';
import { buildCodegenPrompt } from '@/lib/system-prompt';
import { AI_MODELS } from '@/types/ai';

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

function validateArtifactFiles(files: Record<string, string>): Record<string, string> {
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

  if (!entries.some(([path]) => path === '/src/App.tsx')) {
    throw new Error('Code generator output must include /src/App.tsx.');
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
      return validateArtifactFiles(files);
    }
  }

  const singleFile = extractSingleFileFallback(trimmed);
  if (singleFile) {
    return validateArtifactFiles(singleFile);
  }

  throw new Error('Code generator output must be a JSON object with a `files` field or a single fenced TSX/JSX file.');
}

export function createChatTools(fileData: FileDataContext | null) {
  return {
    analyzeData: tool({
      description:
        'Analyze the uploaded data to understand its structure, detect patterns, and determine the best way to represent it. Call this BEFORE generateArtifact when the data needs exploration or when the user asks for insights/analysis.',
      inputSchema: z.object({
        task: z
          .string()
          .describe(
            'What to analyze: e.g., "understand the structure of this leave tracker", "find trends in sales over time"',
          ),
        columns: z.array(z.string()).describe('Which columns to focus the analysis on'),
      }),
      execute: async ({ task, columns }) => {
        const columnData =
          fileData?.sampleData.map((row: Record<string, unknown>) =>
            Object.fromEntries(columns.map((col) => [col, row[col]])),
          ) ?? [];

        const sampleValues = columnData.slice(0, 10);

        const result = await generateText({
          model: openai(AI_MODELS.title),
          output: Output.object({
            schema: z.object({
              summary: z.string().describe('Brief summary of the data analysis'),
              insights: z.array(z.string()).describe('Key patterns, trends, or notable findings'),
              suggestedApproach: z.string().describe('Recommended visualization or UI approach'),
            }),
          }),
          prompt: `Analyze this data for the task: "${task}"
Focused columns: ${columns.join(', ')}
Sample data (${sampleValues.length} rows):
${JSON.stringify(sampleValues, null, 2)}

${fileData ? `Full dataset has ${fileData.rowCount} rows and columns: ${fileData.columnNames.join(', ')}` : 'No file data available.'}

Provide:
1. A concise summary of what the data contains
2. 2-4 specific insights (patterns, outliers, distributions, trends)
3. A recommended approach for visualizing or representing this data`,
        });

        return {
          summary: result.output?.summary ?? `Analyzed ${columns.join(', ')} for: ${task}`,
          insights: result.output?.insights ?? [],
          suggestedApproach: result.output?.suggestedApproach ?? '',
          sampleValues,
        };
      },
    }),

    generateArtifact: tool({
      description:
        'Generate a self-contained React component that transforms the spreadsheet data into an interactive UI. This can be ANYTHING: charts, dashboards, data tables, trackers, calendars, forms, kanban boards, stat card layouts, or any combination. Call this whenever the user needs an interactive representation of their data.',
      inputSchema: z.object({
        title: z.string().describe('Artifact title shown in the UI header'),
        description: z
          .string()
          .describe(
            'Detailed description of what to build. Be specific about: the type of UI (chart, tracker, dashboard, table, calendar, etc.), which data columns to use, how to organize/group the data, what interactions to support (filtering, sorting, tabs), and the overall layout.',
          ),
      }),
      execute: async ({ title, description }) => {
        const { text } = await generateText({
          model: openai(AI_MODELS.codegen),
          system: buildCodegenPrompt(fileData),
          prompt: `Title: "${title}"\n\nDescription: ${description}`,
          maxOutputTokens: 16384,
        });

        const files = parseFilesFromResponse(text);
        return { title, files };
      },
    }),
  };
}
