import 'server-only';

import { generateText, Output, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod/v4';
import type { FileDataContext } from '@/types/file';
import { buildCodegenPrompt } from '@/lib/system-prompt';
import { AI_MODELS } from '@/types/ai';

function parseFilesFromResponse(text: string): Record<string, string> {
  const trimmed = text.trim();

  // Try parsing as raw JSON first (model may output clean JSON)
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.files && typeof parsed.files === 'object') {
      return parsed.files as Record<string, string>;
    }
    // Model returned a flat record directly
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      if (keys.length > 0 && keys[0].startsWith('/')) {
        return parsed as Record<string, string>;
      }
    }
  } catch {
    // Not raw JSON — try extracting from markdown fences
  }

  // Try extracting JSON from markdown code fences
  const fenceMatch = /```(?:json)?\s*\n([\s\S]*?)```/.exec(trimmed);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (parsed.files && typeof parsed.files === 'object') {
        return parsed.files as Record<string, string>;
      }
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      // Malformed JSON inside fence
    }
  }

  // Fallback: treat entire response as a single App.tsx file
  const code = trimmed
    .replace(/^```[\w]*\n/, '')
    .replace(/```$/, '')
    .trim();
  return { '/src/App.tsx': code };
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
