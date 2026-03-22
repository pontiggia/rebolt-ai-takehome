import { invalidRequestError, parseJsonBody, withAuthHandler } from '@/lib/api';
import { artifactOpenAIProxyBodySchema } from '@/lib/artifact/rebolt-openai-proxy-protocol';
import { getConversation, getOwnedFileRecord } from '@/services/conversations';
import {
  forwardArtifactOpenAIProxyRequest,
  isArtifactOpenAIProxyValidationError,
} from '@/services/artifact-openai-proxy';
import { errorResponse } from '@/types/errors';

export const POST = withAuthHandler(async (req, { user }) => {
  const parsedBody = await parseJsonBody(req, artifactOpenAIProxyBodySchema);
  if (!parsedBody.success) {
    return errorResponse(parsedBody.error);
  }

  const { conversationId, fileId, ...proxyRequest } = parsedBody.data;

  const [conversationResult, fileResult] = await Promise.all([
    getConversation(conversationId, user.id),
    fileId ? getOwnedFileRecord(fileId, user.id) : Promise.resolve(null),
  ]);

  if (!conversationResult.ok) {
    return errorResponse(conversationResult.error);
  }

  if (fileResult && !fileResult.ok) {
    return errorResponse(fileResult.error);
  }

  if (fileResult?.ok && fileResult.value.conversationId !== conversationId) {
    return errorResponse(
      invalidRequestError('Artifact OpenAI proxy requests must stay within the current conversation context.'),
    );
  }

  try {
    const response = await forwardArtifactOpenAIProxyRequest(proxyRequest);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    if (isArtifactOpenAIProxyValidationError(error)) {
      return errorResponse(invalidRequestError(error.message));
    }

    return Response.json(
      {
        error: 'OPENAI_PROXY_ERROR',
        message: error instanceof Error ? error.message : 'Rebolt OpenAI proxy request failed.',
      },
      { status: 502 },
    );
  }
});
