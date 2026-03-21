'use client';

import { ClickableFileChip } from '@/components/chat/file-chip';
import type { UploadedFileData } from '@/types/ai';

interface MessageFileChipProps {
  readonly file: UploadedFileData;
  readonly onOpenFilePreview?: (file: UploadedFileData, trigger: HTMLButtonElement) => void;
}

export function MessageFileChip({ file, onOpenFilePreview }: MessageFileChipProps) {
  return (
    <ClickableFileChip
      fileName={file.fileName}
      fileType={file.fileType}
      onClick={(event) => onOpenFilePreview?.(file, event.currentTarget)}
    />
  );
}
