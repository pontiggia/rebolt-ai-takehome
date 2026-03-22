import { z } from 'zod/v4';

export const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
export const REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE = 'rebolt:artifact-openai-proxy-request';
export const REBOLT_OPENAI_PROXY_RESPONSE_MESSAGE_TYPE = 'rebolt:artifact-openai-proxy-response';
export const REBOLT_OPENAI_PROXY_VALIDATION_ERROR_MARKER = '[rebolt-openai-proxy:validation]';
export const REBOLT_OPENAI_PROXY_REQUEST_TIMEOUT_MS = 30_000;
const REBOLT_OPENAI_PROXY_MAX_BODY_CHARS = 50_000;

const serializedHeadersSchema = z.record(z.string().trim().min(1), z.string());

const artifactOpenAIProxyRequestPayloadSchema = z.object({
  url: z.literal(OPENAI_RESPONSES_API_URL),
  method: z.literal('POST'),
  headers: serializedHeadersSchema.default({}),
  body: z.string().min(1).max(REBOLT_OPENAI_PROXY_MAX_BODY_CHARS),
});

export const artifactOpenAIProxyRequestMessageSchema = z.object({
  type: z.literal(REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE),
  requestId: z.string().min(1),
  payload: artifactOpenAIProxyRequestPayloadSchema,
});

type ArtifactOpenAIProxyRequestMessage = z.infer<typeof artifactOpenAIProxyRequestMessageSchema>;

export interface SerializedOpenAIProxyResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

interface ArtifactOpenAIProxyResponseMessage {
  readonly type: typeof REBOLT_OPENAI_PROXY_RESPONSE_MESSAGE_TYPE;
  readonly requestId: string;
  readonly ok: boolean;
  readonly response?: SerializedOpenAIProxyResponse;
  readonly error?: string;
}

export const artifactOpenAIProxyBodySchema = z.object({
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
