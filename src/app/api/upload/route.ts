import { withAuthHandler, invalidRequestError } from '@/lib/api';
import { uploadConversationFile } from '@/services/uploads';
import { errorResponse } from '@/types/errors';
import { z } from 'zod/v4';

const uploadFormSchema = z.object({
  conversationId: z.string().uuid().nullish(),
  file: z.instanceof(File),
});

export const POST = withAuthHandler(async (req, { user }) => {
  const formData = await req.formData();
  const parsedForm = uploadFormSchema.safeParse({
    conversationId: formData.get('conversationId'),
    file: formData.get('file'),
  });

  if (!parsedForm.success) {
    return errorResponse(invalidRequestError('Upload payload did not match the expected shape'));
  }

  const { conversationId, file } = parsedForm.data;
  const uploadResult = await uploadConversationFile({
    conversationId: conversationId ?? undefined,
    userId: user.id,
    file,
  });
  if (!uploadResult.ok) {
    return errorResponse(uploadResult.error);
  }

  return Response.json(uploadResult.value);
});
