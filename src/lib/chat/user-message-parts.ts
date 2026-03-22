import type { FileMetadataResponse } from '@/types/api';
import type { AppUIMessage, AppUIMessagePart, UploadedFileData, UploadedFileDataPart } from '@/types/ai';

export function toUploadedFileData(
  file: Pick<FileMetadataResponse, 'id' | 'fileName' | 'fileType' | 'rowCount'>,
): UploadedFileData {
  return {
    fileId: file.id,
    fileName: file.fileName,
    fileType: file.fileType,
    rowCount: file.rowCount,
  };
}

export function buildUserMessageParts(text: string, uploadedFiles: readonly UploadedFileData[] = []): AppUIMessage['parts'] {
  const trimmedText = text.trim();

  return [
    ...uploadedFiles.map(
      (file) =>
        ({
          type: 'data-uploaded-file' as const,
          data: file,
        }) satisfies UploadedFileDataPart,
    ),
    ...(trimmedText.length > 0
      ? [
          {
            type: 'text' as const,
            text: trimmedText,
          },
        ]
      : []),
  ];
}

function isUploadedFileDataPart(part: AppUIMessagePart): part is UploadedFileDataPart {
  return part.type === 'data-uploaded-file';
}

export function getUploadedFileRefs(parts: readonly AppUIMessagePart[]): UploadedFileData[] {
  return parts.flatMap((part) => (isUploadedFileDataPart(part) ? [part.data] : []));
}
