import { withAuthHandler } from '@/lib/api';
import { invalidRequestError } from '@/lib/api';
import { validateFile, parseFileContents } from '@/services/files';
import { errorResponse } from '@/types/errors';
import { FILE_LIMITS } from '@/types/file';
import type { UploadResponse } from '@/types/api';
import { db } from '@/db/client';
import { conversations, files } from '@/db/schema';
import { getConversation } from '@/services/conversations';
import { eq } from 'drizzle-orm';
import { z } from 'zod/v4';

const uploadFormSchema = z.object({
  conversationId: z.string().uuid(),
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

  const conversation = await getConversation(conversationId, user.id);
  if (!conversation.ok) {
    return errorResponse(conversation.error);
  }

  const validation = validateFile(file);
  if (!validation.ok) return errorResponse(validation.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseFileContents(buffer, file.type);
  if (!parsed.ok) return errorResponse(parsed.error);

  const sampleData = parsed.value.rows.slice(0, FILE_LIMITS.sampleSize) as Record<string, unknown>[];
  const [fileRecord] = await db
    .insert(files)
    .values({
      userId: user.id,
      conversationId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      blobUrl: null,
      columnNames: parsed.value.columnNames as string[],
      rowCount: parsed.value.rowCount,
      sampleData,
    })
    .returning();

  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));

  const response: UploadResponse = {
    fileId: fileRecord.id,
    fileName: fileRecord.fileName,
    columnNames: parsed.value.columnNames,
    rowCount: parsed.value.rowCount,
    preview: parsed.value.rows.slice(0, 5),
    truncated: parsed.value.truncated,
  };

  return Response.json(response);
});
