'use client';

import { useCallback, useRef, useState } from 'react';
import { uploadFile } from '@/lib/api-client';
import { validateUploadableFile } from '@/lib/files/file-validation';
import type { FileMetadataResponse } from '@/types/api';
import { ALLOWED_FILE_TYPES } from '@/types/file';

interface UseFileUploadOptions {
  readonly conversationId: string | null;
  readonly onConversationAdopted?: (conversationId: string) => void;
}

export function useFileUpload({ conversationId, onConversationAdopted }: UseFileUploadOptions) {
  const [pendingFiles, setPendingFiles] = useState<readonly FileMetadataResponse[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadError(null);
      const validation = validateUploadableFile(file);
      if (!validation.ok) {
        setUploadError(validation.error.message);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setIsUploading(true);
      try {
        const result = await uploadFile(conversationId, file);
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
        if (!conversationId) {
          onConversationAdopted?.(result.conversationId);
        }
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [conversationId, onConversationAdopted],
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
