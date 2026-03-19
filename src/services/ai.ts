import 'server-only';

import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod/v4';
import { AI_MODELS } from '@/types/ai';

export async function generateTitle(firstMessage: string): Promise<string> {
  const result = await generateText({
    model: openai(AI_MODELS.title),
    output: Output.object({
      schema: z.object({
        title: z.string().describe('A short 3-6 word title for this conversation'),
      }),
    }),
    prompt: `Generate a concise title for a data analysis chat that starts with: "${firstMessage}"`,
  });
  return result.output?.title ?? 'New Chat';
}
