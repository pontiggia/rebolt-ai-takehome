'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppChat } from '@/hooks/use-app-chat';
import { useConversation } from '@/hooks/use-conversation';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useSentFiles } from '@/hooks/use-sent-files';
import { useAutoReply } from '@/hooks/use-auto-reply';
import { useArtifact } from '@/hooks/use-artifact';
import { useArtifactPanel } from '@/hooks/use-artifact-panel';
import { MessageBubble } from '@/components/message-bubble';
import { ComposerInput } from '@/components/composer-input';
import { ArtifactPanel } from '@/components/artifact-panel';
import { ResizeHandle } from '@/components/resize-handle';
import type { FileMetadataResponse, MessageResponse } from '@/types/api';

interface ChatViewProps {
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly conversationId?: string;
  readonly initialMessages?: readonly MessageResponse[];
  readonly initialFiles?: readonly FileMetadataResponse[];
}

export function ChatView({
  userInitials,
  userAvatarUrl,
  conversationId: propsConversationId,
  initialMessages = [],
  initialFiles = [],
}: ChatViewProps) {
  const conversation = useConversation({ propsConversationId, initialMessages });

  const {
    messages,
    isLoading,
    input,
    setInput,
    handleSend: rawHandleSend,
    sendMessage,
    regenerate,
    error,
  } = useAppChat(conversation.chatConversationId, conversation.chatMessages);

  const hasExistingFiles = initialMessages.length > 0 && initialFiles.length > 0;
  const [initialFilesSent, setInitialFilesSent] = useState(hasExistingFiles);

  const fileUpload = useFileUpload({
    conversationId: conversation.fileConversationId,
    onConversationNeeded: conversation.onConversationNeeded,
    initialFiles: hasExistingFiles && !initialFilesSent ? initialFiles : undefined,
  });

  const { sentFilesMap, trackFiles } = useSentFiles(messages.length);
  const { latestArtifact, artifactState, handleFixError } = useArtifact(messages, sendMessage);
  const { isOpen, setIsOpen, panelWidth, containerRef, handleResizeStart, handleResizeMove, handleResizeEnd } =
    useArtifactPanel(latestArtifact);

  useAutoReply({
    propsConversationId,
    chatConversationId: conversation.chatConversationId,
    messages,
    initialMessages,
    regenerate,
  });

  // Clear input when transitioning from empty state to conversation
  useEffect(() => {
    if (!conversation.isEmptyState) {
      setInput('');
    }
  }, [conversation.isEmptyState, setInput]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const filesToSend = fileUpload.pendingFiles.length > 0 ? [...fileUpload.pendingFiles] : null;

    if (conversation.isEmptyState) {
      conversation.createFirstMessage(input.trim(), filesToSend, () => {
        trackFiles(0, filesToSend!);
        setInitialFilesSent(true);
        fileUpload.clearFiles();
      });
      return;
    }

    if (filesToSend) {
      trackFiles(messages.length, filesToSend);
      setInitialFilesSent(true);
      fileUpload.clearFiles();
    }
    rawHandleSend();
  }, [conversation, input, fileUpload, messages.length, rawHandleSend, setInput, trackFiles]);

  const composerInput = (
    <ComposerInput
      input={input}
      setInput={setInput}
      onSend={handleSend}
      disabled={isLoading || conversation.isPending}
      pendingFiles={fileUpload.pendingFiles}
      isUploading={fileUpload.isUploading}
      uploadError={fileUpload.uploadError}
      onAttachClick={fileUpload.openFilePicker}
      fileInputRef={fileUpload.fileInputRef}
      onFileChange={fileUpload.handleFileChange}
      allowedFileTypes={fileUpload.allowedFileTypes}
    />
  );

  if (conversation.isEmptyState) {
    return (
      <div className="flex h-full flex-col items-center px-4 pt-[20vh]">
        <div className="w-full max-w-2xl space-y-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">What do you need?</h1>
          {conversation.creationError && <p className="text-sm text-destructive">{conversation.creationError}</p>}
          {composerInput}
        </div>
      </div>
    );
  }

  const showPanel = latestArtifact && isOpen;

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const showThinking =
    isLoading &&
    lastMessage !== null &&
    !(
      lastMessage.role === 'assistant' &&
      lastMessage.parts.some((p) => (p.type === 'text' && p.text.length > 0) || p.type.startsWith('tool-'))
    );

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                userInitials={userInitials}
                userAvatarUrl={userAvatarUrl}
                files={sentFilesMap.get(idx)}
                onArtifactClick={() => setIsOpen(true)}
              />
            ))}
            {showThinking && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="animate-pulse">●</span> Thinking...
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error.message}</p>}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">{composerInput}</div>
      </div>
      {showPanel && (
        <div ref={containerRef} className="relative flex h-full flex-col border-l" style={{ width: panelWidth }}>
          <ResizeHandle
            onResizeStart={handleResizeStart}
            onResizeMove={handleResizeMove}
            onResizeEnd={handleResizeEnd}
          />
          <ArtifactPanel
            title={latestArtifact.title}
            files={latestArtifact.files}
            error={artifactState.error}
            retryCount={artifactState.retryCount}
            onFixError={handleFixError}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
