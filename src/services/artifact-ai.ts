import 'server-only';

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { ArtifactInferenceBody } from '@/lib/artifact/rebolt-ai-protocol';
import { AI_MODELS } from '@/types/ai';

const JSON_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)\s*```/i;

function parseJsonOutput(text: string): unknown {
  const trimmed = text.trim();
  const candidate = trimmed.match(JSON_FENCE_PATTERN)?.[1]?.trim() ?? trimmed;

  return JSON.parse(candidate) as unknown;
}

export async function runArtifactInference({
  prompt,
  system,
  format,
}: Pick<ArtifactInferenceBody, 'prompt' | 'system' | 'format'>): Promise<unknown> {
  const result = await generateText({
    model: openai(AI_MODELS.artifactInference),
    system,
    prompt,
    maxOutputTokens: 2_000,
  });

  if (format === 'json') {
    return parseJsonOutput(result.text);
  }

  return result.text.trim();
}
