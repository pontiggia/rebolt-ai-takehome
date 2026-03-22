import { z } from 'zod/v4';
import { invalidRequestError, parseJsonBody, withAuthHandler } from '@/lib/api';
import { artifactOpenAIProxyBodySchema } from '@/lib/artifact/rebolt-openai-proxy-protocol';
import { getConversation, getOwnedFileRecord } from '@/services/conversations';
import {
  forwardArtifactOpenAIProxyRequest,
  isArtifactOpenAIProxyValidationError,
} from '@/services/artifact-openai-proxy';
import { errorResponse } from '@/types/errors';

const paramsSchema = z.object({
  conversationId: z.string().uuid(),
});

export const POST = withAuthHandler<{ params: Promise<{ conversationId: string }> }>(async (req, { user, params }) => {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse(invalidRequestError('Invalid conversation id'));
  }

  const parsedBody = await parseJsonBody(req, artifactOpenAIProxyBodySchema);
  if (!parsedBody.success) {
    return errorResponse(parsedBody.error);
  }

  const { conversationId } = parsedParams.data;
  const { fileId, ...proxyRequest } = parsedBody.data;

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
