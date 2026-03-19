import 'server-only';

import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod/v4';
import type { FileDataContext } from '@/types/file';
import { buildCodegenPrompt } from '@/lib/system-prompt';
import { AI_MODELS } from '@/types/ai';

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

        return {
          summary: `Analyzed ${columns.join(', ')} for: ${task}`,
          insights: [],
          suggestedApproach: '',
          sampleValues: columnData.slice(0, 10),
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
        const { text: code } = await generateText({
          model: openai(AI_MODELS.codegen),
          system: buildCodegenPrompt(fileData),
          prompt: `Title: "${title}"\n\nDescription: ${description}`,
          maxOutputTokens: 8192,
        });

        return { title, code };
      },
    }),
  };
}
