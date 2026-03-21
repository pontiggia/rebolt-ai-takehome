import 'server-only';

import { put } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '@/db/client';
import { conversations, files } from '@/db/schema';
import { getConversation } from '@/services/conversations';
import { storeDatasetForUpload } from '@/services/datasets';
import { parseFileContents, validateFile } from '@/services/files';
import type { UploadResponse } from '@/types/api';
import type { FileError, NotFoundError } from '@/types/errors';
import { FILE_LIMITS, type ParsedFileData } from '@/types/file';
import type { Result } from '@/types/result';
import { ok } from '@/types/result';

interface UploadConversationFileInput {
  readonly conversationId: string;
  readonly userId: string;
  readonly file: File;
}

type UploadConversationFileError = NotFoundError | FileError;

function buildUploadResponse(
  fileRecord: { id: string; fileName: string; blobUrl: string },
  parsed: ParsedFileData,
): UploadResponse {
  return {
    fileId: fileRecord.id,
    fileName: fileRecord.fileName,
    blobUrl: fileRecord.blobUrl,
    columnNames: parsed.columnNames,
    rowCount: parsed.rowCount,
    preview: parsed.rows.slice(0, 5),
    truncated: parsed.truncated,
  };
}

async function persistUploadedFile({
  conversationId,
  userId,
  file,
  parsed,
}: {
  readonly conversationId: string;
  readonly userId: string;
  readonly file: File;
  readonly parsed: ParsedFileData;
}): Promise<UploadResponse> {
  const fileId = uuidv7();
  const sampleData = parsed.rows.slice(0, FILE_LIMITS.sampleSize) as Record<string, unknown>[];

  const [blob] = await Promise.all([
    put(file.name, file, { access: 'public', addRandomSuffix: true }),
    storeDatasetForUpload(
      {
        id: fileId,
        fileName: file.name,
        columnNames: [...parsed.columnNames],
        rowCount: parsed.rowCount,
      },
      parsed.rows,
    ),
  ]);

  const [fileRecord] = await db
    .insert(files)
    .values({
      id: fileId,
      userId,
      conversationId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      blobUrl: blob.url,
      columnNames: [...parsed.columnNames],
      rowCount: parsed.rowCount,
      sampleData,
    })
    .returning();

  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));

  return buildUploadResponse(fileRecord, parsed);
}

export async function uploadConversationFile({
  conversationId,
  userId,
  file,
}: UploadConversationFileInput): Promise<Result<UploadResponse, UploadConversationFileError>> {
  const conversation = await getConversation(conversationId, userId);
  if (!conversation.ok) {
    return conversation;
  }

  const validation = validateFile(file);
  if (!validation.ok) {
    return validation;
  }

  const arrayBuffer = await file.arrayBuffer();
  const parsed = parseFileContents(Buffer.from(arrayBuffer), file.type);
  if (!parsed.ok) {
    return parsed;
  }

  return ok(
    await persistUploadedFile({
      conversationId,
      userId,
      file,
      parsed: parsed.value,
    }),
  );
}
