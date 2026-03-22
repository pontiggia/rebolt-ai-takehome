import {
  ARTIFACT_AI_REQUEST_MESSAGE_TYPE,
  artifactAIRequestMessageSchema,
  artifactInferenceResponseSchema,
  createArtifactAIErrorMessage,
  createArtifactAISuccessMessage,
  getPostMessageTargetOrigin,
  isArtifactAIRequestMessage,
  isPostMessageSourceLike,
  type ArtifactAIContext,
  type PostMessageSourceLike,
} from './rebolt-ai-protocol';

export interface RelayArtifactAIRequestOptions {
  readonly data: unknown;
  readonly origin: string;
  readonly source: unknown;
  readonly conversationId: string | null;
  readonly artifact: ArtifactAIContext | null;
  readonly fetchImpl?: typeof fetch;
  readonly endpoint?: string;
}

async function readBridgeErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as unknown;
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // Response body was not valid JSON
  }

  return fallback;
}

function postBridgeMessage(source: PostMessageSourceLike, origin: string, message: unknown): void {
  source.postMessage(message, getPostMessageTargetOrigin(origin));
}

function getArtifactAIRequestId(value: unknown): string | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === ARTIFACT_AI_REQUEST_MESSAGE_TYPE &&
    'requestId' in value &&
    typeof value.requestId === 'string' &&
    value.requestId.trim().length > 0
  ) {
    return value.requestId.trim();
  }

  return null;
}

function getMalformedRequestMessage(data: unknown): string {
  const parsed = artifactAIRequestMessageSchema.safeParse(data);
  if (parsed.success) {
    return 'Rebolt AI request failed.';
  }

  const promptIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'payload.prompt');
  if (promptIssue) {
    return 'Rebolt AI requests need a non-empty prompt. Use callReboltAIJson({ prompt, system? }) or pass a compact JSON-serializable object.';
  }

  const systemIssue = parsed.error.issues.find((issue) => issue.path.join('.') === 'payload.system');
  if (systemIssue) {
    return 'Rebolt AI system instructions must be strings.';
  }

  return 'Rebolt AI requests must use callReboltAIJson({ prompt, system? }) or callReboltAIText({ prompt, system? }).';
}

export async function relayArtifactAIRequest({
  data,
  origin,
  source,
  conversationId,
  artifact,
  fetchImpl = fetch,
  endpoint = '/api/artifacts/infer',
}: RelayArtifactAIRequestOptions): Promise<boolean> {
  if (!isArtifactAIRequestMessage(data)) {
    const requestId = getArtifactAIRequestId(data);
    if (!requestId) {
      return false;
    }

    if (isPostMessageSourceLike(source)) {
      postBridgeMessage(source, origin, createArtifactAIErrorMessage(requestId, getMalformedRequestMessage(data)));
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
      createArtifactAIErrorMessage(requestId, 'This artifact does not have Rebolt AI enabled.'),
    );
    return true;
  }

  if (!conversationId) {
    postBridgeMessage(
      source,
      origin,
      createArtifactAIErrorMessage(requestId, 'Missing conversation context for Rebolt AI request.'),
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

    if (!response.ok) {
      throw new Error(await readBridgeErrorMessage(response, 'Rebolt AI request failed.'));
    }

    const parsedResponse = artifactInferenceResponseSchema.safeParse((await response.json()) as unknown);
    if (!parsedResponse.success) {
      throw new Error('Rebolt AI returned an invalid response payload.');
    }

    postBridgeMessage(source, origin, createArtifactAISuccessMessage(requestId, parsedResponse.data.output));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rebolt AI request failed.';
    postBridgeMessage(source, origin, createArtifactAIErrorMessage(requestId, message));
  }

  return true;
}
