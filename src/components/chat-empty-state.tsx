'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { ChatInput } from '@/components/chat-input';
import { FileUploadBadge } from '@/components/file-upload-badge';

const ChatPanel = dynamic(() => import('@/components/chat-panel').then((m) => m.ChatPanel), { ssr: false });
import { createConversation, createConversationOnly } from '@/actions/conversations';
import { uploadFile } from '@/lib/api-client';
import { ALLOWED_FILE_TYPES } from '@/types/file';
import type { FileMetadataResponse, MessageResponse } from '@/types/api';

interface ChatEmptyStateProps {
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
}

interface ActiveConversation {
  readonly conversationId: string;
  readonly initialMessage: MessageResponse;
  readonly files: readonly FileMetadataResponse[];
}

export function ChatEmptyState({ userInitials, userAvatarUrl }: ChatEmptyStateProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<FileMetadataResponse[]>([]);
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeConversation) return;
    window.history.replaceState(null, '', `/chat/${activeConversation.conversationId}`);
  }, [activeConversation]);

  if (activeConversation) {
    return (
      <ChatPanel
        conversationId={activeConversation.conversationId}
        initialMessages={[activeConversation.initialMessage]}
        initialFiles={activeConversation.files}
        userInitials={userInitials}
        userAvatarUrl={userAvatarUrl}
      />
    );
  }

  const handleSend = () => {
    if (!input.trim() || isPending) return;
    setError(null);

    startTransition(async () => {
      try {
        const { id, messageId } = await createConversation(input.trim(), pendingConversationId ?? undefined);

        setActiveConversation({
          conversationId: id,
          initialMessage: {
            id: messageId,
            role: 'user',
            content: input.trim(),
            parts: [{ type: 'text', text: input.trim() }],
            createdAt: new Date().toISOString(),
          },
          files: pendingFiles,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create conversation');
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      let convId = pendingConversationId;
      if (!convId) {
        const { id } = await createConversationOnly();
        convId = id;
        setPendingConversationId(id);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-full flex-col items-center px-4 pt-[20vh]">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">What do you need?</h1>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_FILE_TYPES.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />

        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {pendingFiles.map((file) => (
              <FileUploadBadge key={file.id} fileName={file.fileName} rowCount={file.rowCount} />
            ))}
          </div>
        )}

        <ChatInput>
          <ChatInput.Toolbar
            left={<ChatInput.AttachButton onClick={() => fileInputRef.current?.click()} isUploading={isUploading} />}
            right={
              <ChatInput.SubmitButton
                hasContent={!!input.trim()}
                disabled={!input.trim() || isPending}
                onClick={handleSend}
              />
            }
          />
          <ChatInput.TextArea value={input} onChange={setInput} onSubmit={handleSend} disabled={isPending} />
        </ChatInput>
      </div>
    </div>
  );
}
