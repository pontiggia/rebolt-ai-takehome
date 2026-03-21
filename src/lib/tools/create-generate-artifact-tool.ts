import 'server-only';

import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod/v4';
import { getActivityReporter, getToolInternalActivityId } from '@/lib/agent-activity';
import { buildCodegenPrompt } from '@/lib/system-prompt';
import { injectDatasetRuntimeHelper } from '@/lib/tools/dataset-runtime-helper';
import { parseFilesFromResponse, validateArtifactFiles } from '@/lib/tools/artifact-file-parser';
import { AI_MODELS, type ArtifactToolInput } from '@/types/ai';
import type { FileDataContext } from '@/types/file';

export function createGenerateArtifactTool(fileData: FileDataContext | null) {
  return tool({
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
    execute: async ({ title, description }: ArtifactToolInput, { toolCallId, experimental_context }) => {
      const reportActivity = getActivityReporter(experimental_context);
      const internalActivityId = getToolInternalActivityId(toolCallId);

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'running',
          label: 'Starting codegen',
          detail: title,
          toolName: 'generateArtifact',
          toolCallId,
        },
      });

      const { text } = await generateText({
        model: openai(AI_MODELS.codegen),
        system: buildCodegenPrompt(fileData),
        prompt: `Title: "${title}"\n\nDescription: ${description}`,
        maxOutputTokens: 16384,
      });

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'running',
          label: 'Codegen finished',
          detail: title,
          toolName: 'generateArtifact',
          toolCallId,
        },
      });

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'running',
          label: 'Parsing files',
          detail: title,
          toolName: 'generateArtifact',
          toolCallId,
        },
      });
      const parsedFiles = parseFilesFromResponse(text);

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'running',
          label: 'Validating artifact',
          detail: title,
          toolName: 'generateArtifact',
          toolCallId,
        },
      });
      const validatedFiles = validateArtifactFiles(parsedFiles, {
        requiresDatasetHelper: Boolean(fileData),
      });

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'running',
          label: 'Injecting dataset helper',
          detail: fileData ? 'Preparing runtime data access' : title,
          toolName: 'generateArtifact',
          toolCallId,
        },
      });
      const files = injectDatasetRuntimeHelper(validatedFiles, fileData);

      reportActivity?.({
        id: internalActivityId,
        transient: true,
        activity: {
          kind: 'tool-internal',
          status: 'completed',
          label: 'Injecting dataset helper',
          detail: 'Artifact runtime ready',
          toolName: 'generateArtifact',
          toolCallId,
        },
      });

      return { title, fileId: fileData?.fileId ?? null, files };
    },
  });
}
