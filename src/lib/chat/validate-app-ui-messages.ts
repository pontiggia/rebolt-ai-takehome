import 'server-only';

import { safeValidateUIMessages } from 'ai';
import type { Tool } from 'ai';
import { z } from 'zod/v4';
import type { createChatTools } from '@/lib/tools';
import type { AppUIMessage } from '@/types/ai';

const appToolNameSchema = z.enum(['analyzeData', 'readDatasetRows', 'generateArtifact']);

export const agentActivityDataSchema = z.object({
  kind: z.enum(['step', 'tool', 'tool-internal']),
  status: z.enum(['running', 'completed', 'error']),
  label: z.string().min(1),
  detail: z.string().optional(),
  stepNumber: z.number().int().positive().optional(),
  toolName: appToolNameSchema.optional(),
  toolCallId: z.string().min(1).optional(),
});

export const uploadedFileDataSchema = z.object({
  fileId: z.string().uuid(),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  rowCount: z.number().int().nonnegative(),
});

const appUIMessageDataSchemas = {
  'agent-activity': agentActivityDataSchema,
  'uploaded-file': uploadedFileDataSchema,
} as const;

interface ValidateAppUIMessagesOptions {
  readonly messages: unknown;
  readonly tools: ReturnType<typeof createChatTools>;
}

export async function validateAppUIMessages({ messages, tools }: ValidateAppUIMessagesOptions) {
  return safeValidateUIMessages<AppUIMessage>({
    messages,
    dataSchemas: appUIMessageDataSchemas,
    tools: tools as Record<string, Tool<unknown, unknown>>,
  });
}
