import 'server-only';

import { generateText, Output, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod/v4';
import { getActivityReporter, getToolInternalActivityId } from '@/lib/agent-activity';
import { loadDatasetEnvelope } from '@/services/datasets';
import { AI_MODELS, type AnalyzeDataToolInput } from '@/types/ai';
import type { FileDataContext } from '@/types/file';
import { pickSelectedColumns } from '@/lib/tools/dataset-selection';

export function createAnalyzeDataTool(fileData: FileDataContext | null) {
  return tool({
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
    execute: async ({ task, columns }: AnalyzeDataToolInput, { toolCallId, experimental_context }) => {
      const reportActivity = getActivityReporter(experimental_context);
      const internalActivityId = getToolInternalActivityId(toolCallId);

      if (!fileData) {
        return {
          summary: 'No file data is available yet.',
          insights: [],
          suggestedApproach: 'Ask the user to upload a CSV or Excel file first.',
          sampleValues: [],
        };
      }

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'running',
          label: 'Loading dataset',
          detail: task,
          toolName: 'analyzeData',
          toolCallId,
        },
      });

      const envelope = await loadDatasetEnvelope(fileData.fileId, fileData.datasetUrl);
      const selectedColumns = pickSelectedColumns(fileData, columns);
      const selectedProfiles = envelope.profile.columns.filter((profile) => selectedColumns.includes(profile.name));
      const sampleValues = envelope.rows
        .slice(0, 10)
        .map((row) => Object.fromEntries(selectedColumns.map((column) => [column, row[column]])));

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'running',
          label: 'Running analysis model',
          detail: selectedColumns.join(', '),
          toolName: 'analyzeData',
          toolCallId,
        },
      });

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

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'completed',
          label: 'Analysis ready',
          detail: result.output?.summary ?? 'Analysis complete',
          toolName: 'analyzeData',
          toolCallId,
        },
      });

      return {
        summary: result.output?.summary ?? `Analyzed ${selectedColumns.join(', ')} for: ${task}`,
        insights: result.output?.insights ?? [],
        suggestedApproach: result.output?.suggestedApproach ?? '',
        sampleValues,
      };
    },
  });
}
