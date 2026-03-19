'use client';

import { startTransition, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUploadBadge } from '@/components/file-upload-badge';
import type { FileMetadataResponse } from '@/types/api';
import { ALLOWED_FILE_TYPES } from '@/types/file';

interface MessageInputProps {
  readonly input: string;
  readonly setInput: (value: string) => void;
  readonly handleSend: () => void;
  readonly isLoading: boolean;
  readonly conversationId: string;
  readonly files: readonly FileMetadataResponse[];
}

export function MessageInput({ input, setInput, handleSend, isLoading, conversationId, files }: MessageInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', conversationId);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? 'Upload failed');
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-t px-4 py-3">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file) => (
            <FileUploadBadge key={file.id} fileName={file.fileName} rowCount={file.rowCount} />
          ))}
        </div>
      )}
      {uploadError && <p className="mb-2 text-sm text-destructive">{uploadError}</p>}
      <div className="flex items-center gap-2 rounded-xl border bg-background px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {isUploading ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_FILE_TYPES.join(',')}
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          type="text"
          placeholder="Tell me what do you need"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
