import 'server-only';

import {
  OPENAI_RESPONSES_API_URL,
  type ArtifactOpenAIProxyBody,
  type SerializedOpenAIProxyResponse,
} from '@/lib/artifact/rebolt-openai-proxy-protocol';

const AUTH_HEADER_PATTERN = /^(authorization|x-api-key|api-key|openai-organization|openai-project)$/i;
const ALLOWED_HEADER_NAMES = new Set(['accept', 'content-type']);
const OPENAI_MODEL_ID = 'gpt-4.1';

class ArtifactOpenAIProxyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArtifactOpenAIProxyValidationError';
  }
}

export function isArtifactOpenAIProxyValidationError(
  value: unknown,
): value is ArtifactOpenAIProxyValidationError {
  return value instanceof ArtifactOpenAIProxyValidationError;
}

function normalizeHeaders(headers: ArtifactOpenAIProxyBody['headers']): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = rawName.trim().toLowerCase();
    if (!name) {
      continue;
    }

    if (AUTH_HEADER_PATTERN.test(name)) {
      throw new ArtifactOpenAIProxyValidationError(
        'Artifacts must not send Authorization or API-key headers. Rebolt injects OpenAI auth automatically.',
      );
    }

    if (!ALLOWED_HEADER_NAMES.has(name)) {
      continue;
    }

    normalized[name] = rawValue;
  }

  if (!normalized['content-type']) {
    normalized['content-type'] = 'application/json';
  }

  return normalized;
}

function normalizeBody(body: ArtifactOpenAIProxyBody['body']): string {
  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(body) as unknown;
  } catch {
    throw new ArtifactOpenAIProxyValidationError('OpenAI Responses API calls must send a valid JSON object body.');
  }

  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    throw new ArtifactOpenAIProxyValidationError('OpenAI Responses API calls must send a JSON object body.');
  }

  return JSON.stringify({
    ...parsedBody,
    model: OPENAI_MODEL_ID,
    stream: false,
  });
}

function normalizeResponseHeaders(response: Response): Record<string, string> {
  const contentType = response.headers.get('content-type');

  return contentType ? { 'content-type': contentType } : { 'content-type': 'application/json' };
}

export async function forwardArtifactOpenAIProxyRequest(
  request: Pick<ArtifactOpenAIProxyBody, 'url' | 'method' | 'headers' | 'body'>,
  fetchImpl: typeof fetch = fetch,
): Promise<SerializedOpenAIProxyResponse> {
  if (request.url !== OPENAI_RESPONSES_API_URL) {
    throw new ArtifactOpenAIProxyValidationError('Only the OpenAI Responses API is supported in artifact proxy mode.');
  }

  if (request.method !== 'POST') {
    throw new ArtifactOpenAIProxyValidationError('OpenAI artifact proxy requests must use POST.');
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OpenAI proxy is not configured. Set OPENAI_API_KEY on the server.');
  }

  const response = await fetchImpl(OPENAI_RESPONSES_API_URL, {
    method: 'POST',
    headers: {
      ...normalizeHeaders(request.headers),
      Authorization: `Bearer ${apiKey}`,
    },
    body: normalizeBody(request.body),
  });

  return {
    status: response.status,
    statusText: response.statusText,
    headers: normalizeResponseHeaders(response),
    body: await response.text(),
  };
}
