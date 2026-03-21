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
import { ok, type Result } from '@/types/result';

interface UploadConversationFileInput {
  readonly conversationId?: string;
  readonly userId: string;
  readonly file: File;
}

type UploadConversationFileError = NotFoundError | FileError;

interface StoredUpload {
  readonly fileId: string;
  readonly blobUrl: string;
  readonly sampleData: readonly Record<string, unknown>[];
}

function buildUploadResponse(
  fileRecord: { id: string; fileName: string; blobUrl: string; conversationId: string },
  parsed: ParsedFileData,
): UploadResponse {
  return {
    conversationId: fileRecord.conversationId,
    fileId: fileRecord.id,
    fileName: fileRecord.fileName,
    blobUrl: fileRecord.blobUrl,
    columnNames: parsed.columnNames,
    rowCount: parsed.rowCount,
    preview: parsed.rows.slice(0, 5),
    truncated: parsed.truncated,
  };
}

async function storeUploadedAssets(file: File, parsed: ParsedFileData): Promise<StoredUpload> {
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

  return {
    fileId,
    blobUrl: blob.url,
    sampleData,
  };
}

async function persistUploadedFile({
  conversationId,
  userId,
  file,
  parsed,
  storedUpload,
}: {
  readonly conversationId?: string;
  readonly userId: string;
  readonly file: File;
  readonly parsed: ParsedFileData;
  readonly storedUpload: StoredUpload;
}): Promise<UploadResponse> {
  return db.transaction(async (tx) => {
    let resolvedConversationId = conversationId;

    if (!resolvedConversationId) {
      const [conversation] = await tx.insert(conversations).values({ userId }).returning();
      resolvedConversationId = conversation.id;
    }

    const [fileRecord] = await tx
      .insert(files)
      .values({
        id: storedUpload.fileId,
        userId,
        conversationId: resolvedConversationId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        blobUrl: storedUpload.blobUrl,
        columnNames: [...parsed.columnNames],
        rowCount: parsed.rowCount,
        sampleData: [...storedUpload.sampleData],
      })
      .returning();

    await tx.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, resolvedConversationId));

    return buildUploadResponse(fileRecord, parsed);
  });
}

export async function uploadConversationFile({
  conversationId,
  userId,
  file,
}: UploadConversationFileInput): Promise<Result<UploadResponse, UploadConversationFileError>> {
  if (conversationId) {
    const conversation = await getConversation(conversationId, userId);
    if (!conversation.ok) {
      return conversation;
    }
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

  const storedUpload = await storeUploadedAssets(file, parsed.value);

  return ok(
    await persistUploadedFile({
      conversationId,
      userId,
      file,
      parsed: parsed.value,
      storedUpload,
    }),
  );
}
