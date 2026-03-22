import { z } from 'zod/v4';

export const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
export const REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE = 'rebolt:artifact-openai-proxy-request';
export const REBOLT_OPENAI_PROXY_RESPONSE_MESSAGE_TYPE = 'rebolt:artifact-openai-proxy-response';
export const REBOLT_OPENAI_PROXY_VALIDATION_ERROR_MARKER = '[rebolt-openai-proxy:validation]';
export const REBOLT_OPENAI_PROXY_REQUEST_TIMEOUT_MS = 30_000;
export const REBOLT_OPENAI_PROXY_MAX_BODY_CHARS = 50_000;

const serializedHeadersSchema = z.record(z.string().trim().min(1), z.string());

export const artifactOpenAIProxyRequestPayloadSchema = z.object({
  url: z.literal(OPENAI_RESPONSES_API_URL),
  method: z.literal('POST'),
  headers: serializedHeadersSchema.default({}),
  body: z.string().min(1).max(REBOLT_OPENAI_PROXY_MAX_BODY_CHARS),
});

export type ArtifactOpenAIProxyRequestPayload = z.infer<typeof artifactOpenAIProxyRequestPayloadSchema>;

export const artifactOpenAIProxyRequestMessageSchema = z.object({
  type: z.literal(REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE),
  requestId: z.string().min(1),
  payload: artifactOpenAIProxyRequestPayloadSchema,
});

export type ArtifactOpenAIProxyRequestMessage = z.infer<typeof artifactOpenAIProxyRequestMessageSchema>;

export const serializedOpenAIProxyResponseSchema = z.object({
  status: z.number().int().nonnegative(),
  statusText: z.string(),
  headers: serializedHeadersSchema,
  body: z.string(),
});

export type SerializedOpenAIProxyResponse = z.infer<typeof serializedOpenAIProxyResponseSchema>;

export const artifactOpenAIProxyResponseMessageSchema = z.object({
  type: z.literal(REBOLT_OPENAI_PROXY_RESPONSE_MESSAGE_TYPE),
  requestId: z.string().min(1),
  ok: z.boolean(),
  response: serializedOpenAIProxyResponseSchema.optional(),
  error: z.string().optional(),
});

export type ArtifactOpenAIProxyResponseMessage = z.infer<typeof artifactOpenAIProxyResponseMessageSchema>;

export const artifactOpenAIProxyBodySchema = z.object({
  conversationId: z.string().uuid(),
  fileId: z.string().uuid().nullable().optional(),
  url: z.literal(OPENAI_RESPONSES_API_URL),
  method: z.literal('POST'),
  headers: serializedHeadersSchema.default({}),
  body: z.string().min(1).max(REBOLT_OPENAI_PROXY_MAX_BODY_CHARS),
});

export type ArtifactOpenAIProxyBody = z.infer<typeof artifactOpenAIProxyBodySchema>;

export interface ArtifactOpenAIProxyContext {
  readonly fileId: string | null;
  readonly usesReboltAI: boolean;
}

export interface PostMessageSourceLike {
  postMessage: (message: unknown, targetOrigin: string) => void;
}

export function isArtifactOpenAIProxyRequestMessage(value: unknown): value is ArtifactOpenAIProxyRequestMessage {
  return artifactOpenAIProxyRequestMessageSchema.safeParse(value).success;
}

export function isArtifactOpenAIProxyResponseMessage(value: unknown): value is ArtifactOpenAIProxyResponseMessage {
  return artifactOpenAIProxyResponseMessageSchema.safeParse(value).success;
}

export function isPostMessageSourceLike(value: unknown): value is PostMessageSourceLike {
  return (
    typeof value === 'object' && value !== null && 'postMessage' in value && typeof value.postMessage === 'function'
  );
}

export function getPostMessageTargetOrigin(origin: string): string {
  return origin && origin !== 'null' ? origin : '*';
}

export function createArtifactOpenAIProxySuccessMessage(
  requestId: string,
  response: SerializedOpenAIProxyResponse,
): ArtifactOpenAIProxyResponseMessage {
  return {
    type: REBOLT_OPENAI_PROXY_RESPONSE_MESSAGE_TYPE,
    requestId,
    ok: true,
    response,
  };
}

export function createArtifactOpenAIProxyErrorMessage(
  requestId: string,
  error: string,
): ArtifactOpenAIProxyResponseMessage {
  return {
    type: REBOLT_OPENAI_PROXY_RESPONSE_MESSAGE_TYPE,
    requestId,
    ok: false,
    error,
  };
}
