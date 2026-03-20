'use client';

import type { RefObject } from 'react';
import { ChatInput } from '@/components/chat-input';
import { FileUploadBadge } from '@/components/file-upload-badge';
import type { FileMetadataResponse } from '@/types/api';

interface ComposerInputProps {
  readonly input: string;
  readonly setInput: (value: string) => void;
  readonly onSend: () => void;
  readonly disabled: boolean;
  readonly pendingFiles: readonly FileMetadataResponse[];
  readonly isUploading: boolean;
  readonly uploadError: string | null;
  readonly onAttachClick: () => void;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly allowedFileTypes: readonly string[];
  readonly className?: string;
}

export function ComposerInput({
  input,
  setInput,
  onSend,
  disabled,
  pendingFiles,
  isUploading,
  uploadError,
  onAttachClick,
  fileInputRef,
  onFileChange,
  allowedFileTypes,
  className,
}: ComposerInputProps) {
  return (
    <div className={className}>
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map((file) => (
            <FileUploadBadge key={file.id} fileName={file.fileName} rowCount={file.rowCount} />
          ))}
        </div>
      )}
      {uploadError && <p className="mb-2 text-sm text-destructive">{uploadError}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={allowedFileTypes.join(',')}
        onChange={onFileChange}
        className="hidden"
      />

      <ChatInput>
        <ChatInput.Toolbar
          left={<ChatInput.AttachButton onClick={onAttachClick} isUploading={isUploading} />}
          right={
            <ChatInput.SubmitButton hasContent={!!input.trim()} disabled={!input.trim() || disabled} onClick={onSend} />
          }
        />
        <ChatInput.TextArea value={input} onChange={setInput} onSubmit={onSend} disabled={disabled} />
      </ChatInput>
    </div>
  );
}
