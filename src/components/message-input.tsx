'use client';

import { startTransition, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInput } from '@/components/chat-input';
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
    <div className="px-4 pb-4">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file) => (
            <FileUploadBadge key={file.id} fileName={file.fileName} rowCount={file.rowCount} />
          ))}
        </div>
      )}
      {uploadError && <p className="mb-2 text-sm text-destructive">{uploadError}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_FILE_TYPES.join(',')}
        onChange={handleFileUpload}
        className="hidden"
      />

      <ChatInput>
        <ChatInput.Toolbar
          left={<ChatInput.AttachButton onClick={() => fileInputRef.current?.click()} isUploading={isUploading} />}
          right={
            <ChatInput.SubmitButton
              hasContent={!!input.trim()}
              disabled={!input.trim() || isLoading}
              onClick={handleSend}
            />
          }
        />
        <ChatInput.TextArea value={input} onChange={setInput} onSubmit={handleSend} disabled={isLoading} />
      </ChatInput>
    </div>
  );
}
