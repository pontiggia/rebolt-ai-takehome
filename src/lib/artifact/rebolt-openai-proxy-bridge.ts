import {
  REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE,
  artifactOpenAIProxyRequestMessageSchema,
  createArtifactOpenAIProxyErrorMessage,
  createArtifactOpenAIProxySuccessMessage,
  getPostMessageTargetOrigin,
  isArtifactOpenAIProxyRequestMessage,
  isPostMessageSourceLike,
  type ArtifactOpenAIProxyContext,
  type PostMessageSourceLike,
  type SerializedOpenAIProxyResponse,
} from './rebolt-openai-proxy-protocol';

export interface RelayArtifactOpenAIProxyRequestOptions {
  readonly data: unknown;
  readonly origin: string;
  readonly source: unknown;
  readonly conversationId: string | null;
  readonly artifact: ArtifactOpenAIProxyContext | null;
  readonly fetchImpl?: typeof fetch;
  readonly endpoint?: string;
}

function postBridgeMessage(source: PostMessageSourceLike, origin: string, message: unknown): void {
  source.postMessage(message, getPostMessageTargetOrigin(origin));
}

function getRequestId(value: unknown): string | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE &&
    'requestId' in value &&
    typeof value.requestId === 'string' &&
    value.requestId.trim().length > 0
  ) {
    return value.requestId.trim();
  }

  return null;
}

function getMalformedRequestMessage(data: unknown): string {
  const parsed = artifactOpenAIProxyRequestMessageSchema.safeParse(data);
  if (parsed.success) {
    return 'Rebolt OpenAI proxy request failed.';
  }

  const urlIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'payload.url');
  if (urlIssue) {
    return 'Artifacts may only call POST https://api.openai.com/v1/responses through the Rebolt OpenAI proxy.';
  }

  const methodIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'payload.method');
  if (methodIssue) {
    return 'Artifacts may only use POST when calling the OpenAI Responses API.';
  }

  return 'Artifacts must call fetch("https://api.openai.com/v1/responses", { method: "POST", ... }) when using the Rebolt OpenAI proxy.';
}

async function serializeResponse(response: Response): Promise<SerializedOpenAIProxyResponse> {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
  };
}

export async function relayArtifactOpenAIProxyRequest({
  data,
  origin,
  source,
  conversationId,
  artifact,
  fetchImpl = fetch,
  endpoint = '/api/artifacts/openai-proxy',
}: RelayArtifactOpenAIProxyRequestOptions): Promise<boolean> {
  if (!isArtifactOpenAIProxyRequestMessage(data)) {
    const requestId = getRequestId(data);
    if (!requestId) {
      return false;
    }

    if (isPostMessageSourceLike(source)) {
      postBridgeMessage(source, origin, createArtifactOpenAIProxyErrorMessage(requestId, getMalformedRequestMessage(data)));
    }

    return false;
  }

  if (!isPostMessageSourceLike(source)) {
    return true;
  }

  const { requestId, payload } = data;

  if (!artifact?.usesReboltAI) {
    postBridgeMessage(
      source,
      origin,
      createArtifactOpenAIProxyErrorMessage(requestId, 'This artifact does not have Rebolt AI enabled.'),
    );
    return true;
  }

  if (!conversationId) {
    postBridgeMessage(
      source,
      origin,
      createArtifactOpenAIProxyErrorMessage(requestId, 'Missing conversation context for Rebolt OpenAI proxy request.'),
    );
    return true;
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        fileId: artifact.fileId,
        ...payload,
      }),
    });

    postBridgeMessage(
      source,
      origin,
      createArtifactOpenAIProxySuccessMessage(requestId, await serializeResponse(response)),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rebolt OpenAI proxy request failed.';
    postBridgeMessage(source, origin, createArtifactOpenAIProxyErrorMessage(requestId, message));
  }

  return true;
}
