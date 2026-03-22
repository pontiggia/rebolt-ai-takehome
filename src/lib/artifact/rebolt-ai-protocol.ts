import { z } from 'zod/v4';

export const ARTIFACT_AI_REQUEST_MESSAGE_TYPE = 'rebolt:artifact-ai-request';
export const ARTIFACT_AI_RESPONSE_MESSAGE_TYPE = 'rebolt:artifact-ai-response';
export const ARTIFACT_AI_VALIDATION_ERROR_MARKER = '[rebolt-ai:validation]';
export const ARTIFACT_AI_REQUEST_TIMEOUT_MS = 30_000;
export const ARTIFACT_AI_MAX_PROMPT_CHARS = 12_000;

export const artifactAIResponseFormatSchema = z.enum(['text', 'json']);

export const artifactAIRequestPayloadSchema = z.object({
  prompt: z.string().trim().min(1).max(ARTIFACT_AI_MAX_PROMPT_CHARS),
  system: z.string().trim().min(1).max(ARTIFACT_AI_MAX_PROMPT_CHARS).optional(),
  format: artifactAIResponseFormatSchema.default('text'),
});

export type ArtifactAIRequestPayload = z.infer<typeof artifactAIRequestPayloadSchema>;

export const artifactAIRequestMessageSchema = z.object({
  type: z.literal(ARTIFACT_AI_REQUEST_MESSAGE_TYPE),
  requestId: z.string().min(1),
  payload: artifactAIRequestPayloadSchema,
});

export type ArtifactAIRequestMessage = z.infer<typeof artifactAIRequestMessageSchema>;

export const artifactAIResponseMessageSchema = z.object({
  type: z.literal(ARTIFACT_AI_RESPONSE_MESSAGE_TYPE),
  requestId: z.string().min(1),
  ok: z.boolean(),
  output: z.unknown().optional(),
  error: z.string().optional(),
});

export type ArtifactAIResponseMessage = z.infer<typeof artifactAIResponseMessageSchema>;

export const artifactInferenceBodySchema = z.object({
  conversationId: z.string().uuid(),
  fileId: z.string().uuid().nullable().optional(),
  prompt: z.string().trim().min(1).max(ARTIFACT_AI_MAX_PROMPT_CHARS),
  system: z.string().trim().min(1).max(ARTIFACT_AI_MAX_PROMPT_CHARS).optional(),
  format: artifactAIResponseFormatSchema.default('text'),
});

export type ArtifactInferenceBody = z.infer<typeof artifactInferenceBodySchema>;

export const artifactInferenceResponseSchema = z.object({
  output: z.unknown(),
});

export interface ArtifactAIContext {
  readonly fileId: string | null;
  readonly usesReboltAI: boolean;
}

export interface PostMessageSourceLike {
  postMessage: (message: unknown, targetOrigin: string) => void;
}

export function isArtifactAIRequestMessage(value: unknown): value is ArtifactAIRequestMessage {
  return artifactAIRequestMessageSchema.safeParse(value).success;
}

export function isArtifactAIResponseMessage(value: unknown): value is ArtifactAIResponseMessage {
  return artifactAIResponseMessageSchema.safeParse(value).success;
}

export function isPostMessageSourceLike(value: unknown): value is PostMessageSourceLike {
  return (
    typeof value === 'object' && value !== null && 'postMessage' in value && typeof value.postMessage === 'function'
  );
}

export function getPostMessageTargetOrigin(origin: string): string {
  return origin && origin !== 'null' ? origin : '*';
}

export function createArtifactAISuccessMessage(requestId: string, output: unknown): ArtifactAIResponseMessage {
  return {
    type: ARTIFACT_AI_RESPONSE_MESSAGE_TYPE,
    requestId,
    ok: true,
    output,
  };
}

export function createArtifactAIErrorMessage(requestId: string, error: string): ArtifactAIResponseMessage {
  return {
    type: ARTIFACT_AI_RESPONSE_MESSAGE_TYPE,
    requestId,
    ok: false,
    error,
  };
}
