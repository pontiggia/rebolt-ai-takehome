import { invalidRequestError, parseJsonBody, withAuthHandler } from '@/lib/api';
import { artifactInferenceBodySchema } from '@/lib/artifact/rebolt-ai-protocol';
import { getConversation, getOwnedFileRecord } from '@/services/conversations';
import { runArtifactInference } from '@/services/artifact-ai';
import { errorResponse } from '@/types/errors';

export const POST = withAuthHandler(async (req, { user }) => {
  const parsedBody = await parseJsonBody(req, artifactInferenceBodySchema);
  if (!parsedBody.success) {
    return errorResponse(parsedBody.error);
  }

  const { conversationId, fileId, prompt, system, format } = parsedBody.data;

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
      invalidRequestError('Artifact AI requests must stay within the current conversation context.'),
    );
  }

  try {
    const output = await runArtifactInference({
      prompt,
      system,
      format,
    });

    return Response.json({ output });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : format === 'json'
          ? 'Rebolt AI returned invalid JSON.'
          : 'Rebolt AI request failed.';

    return Response.json(
      {
        error: 'INFERENCE_ERROR',
        message,
      },
      { status: 502 },
    );
  }
});
