'use client';

import { type RefObject, useCallback, useRef, useState } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length === 0) return;

      const fileInput = fileInputRef.current;
      if (!fileInput) return;

      const dt = new DataTransfer();
      for (const file of Array.from(droppedFiles)) {
        dt.items.add(file);
      }
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [fileInputRef],
  );

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

      <ChatInput
        className={isDragging ? 'ring-2 ring-primary/50' : ''}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
