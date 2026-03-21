import { z } from 'zod/v4';
import { invalidRequestError, withAuthHandler } from '@/lib/api';
import { getOwnedFileRecord } from '@/services/conversations';
import { buildFilePreview } from '@/services/files';
import { errorResponse } from '@/types/errors';

const paramsSchema = z.object({
  fileId: z.string().uuid(),
});

export const GET = withAuthHandler<{ params: Promise<{ fileId: string }> }>(async (_req, { user, params }) => {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return errorResponse(invalidRequestError('Invalid file id'));
  }

  const file = await getOwnedFileRecord(parsedParams.data.fileId, user.id);
  if (!file.ok) {
    return errorResponse(file.error);
  }

  try {
    return Response.json(await buildFilePreview(file.value));
  } catch {
    return Response.json({ error: 'PREVIEW_ERROR', message: 'Failed to generate file preview' }, { status: 500 });
  }
});
