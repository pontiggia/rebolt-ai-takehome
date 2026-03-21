'use client';

import { useCallback, useRef, useState } from 'react';
import { uploadFile } from '@/lib/api-client';
import type { FileMetadataResponse } from '@/types/api';
import { ALLOWED_FILE_TYPES } from '@/types/file';

interface UseFileUploadOptions {
  readonly conversationId: string | null;
  readonly onConversationNeeded?: () => Promise<string>;
}

export function useFileUpload({ conversationId, onConversationNeeded }: UseFileUploadOptions) {
  const [pendingFiles, setPendingFiles] = useState<readonly FileMetadataResponse[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setUploadError(null);
      try {
        let convId = conversationId;
        if (!convId) {
          if (!onConversationNeeded) {
            throw new Error('No conversation available for upload');
          }
          convId = await onConversationNeeded();
        }

        const result = await uploadFile(convId, file);
        setPendingFiles((prev) => [
          ...prev,
          {
            id: result.fileId,
            fileName: result.fileName,
            fileType: file.type,
            columnNames: [...result.columnNames],
            rowCount: result.rowCount,
          },
        ]);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [conversationId, onConversationNeeded],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearFiles = useCallback(() => {
    setPendingFiles([]);
  }, []);

  return {
    pendingFiles,
    isUploading,
    uploadError,
    fileInputRef,
    handleFileChange,
    openFilePicker,
    clearFiles,
    allowedFileTypes: ALLOWED_FILE_TYPES,
  } as const;
}
