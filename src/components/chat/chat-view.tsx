'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppChat } from '@/hooks/use-app-chat';
import { useArtifactRequestRelay } from '@/hooks/use-artifact-request-relay';
import { useConversation } from '@/hooks/use-conversation';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useSentFiles } from '@/hooks/use-sent-files';
import { useAutoReply } from '@/hooks/use-auto-reply';
import { useArtifact } from '@/hooks/use-artifact';
import { useArtifactPanel } from '@/hooks/use-artifact-panel';
import { ChatViewArtifactPane } from '@/components/chat/chat-view-artifact-pane';
import { ChatViewConversationPane } from '@/components/chat/chat-view-conversation-pane';
import { ChatViewEmptyState } from '@/components/chat/chat-view-empty-state';
import { ComposerInput } from '@/components/chat/composer-input';
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
    relayError: relayArtifactError,
    relayFinish: relayArtifactFinish,
    setCallbacks: setArtifactRequestCallbacks,
  } = useArtifactRequestRelay();

  const {
    messages,
    status,
    isLoading,
    input,
    setInput,
    handleSend: rawHandleSend,
    regenerate,
    error,
  } = useAppChat(conversation.chatConversationId, conversation.chatMessages, {
    onError: relayArtifactError,
    onFinish: relayArtifactFinish,
  });

  const hasExistingFiles = initialMessages.length > 0 && initialFiles.length > 0;
  const [initialFilesSent, setInitialFilesSent] = useState(hasExistingFiles);

  const fileUpload = useFileUpload({
    conversationId: conversation.fileConversationId,
    onConversationNeeded: conversation.onConversationNeeded,
    initialFiles: hasExistingFiles && !initialFilesSent ? initialFiles : undefined,
  });

  const latestFileId =
    fileUpload.pendingFiles.length > 0 ? fileUpload.pendingFiles[fileUpload.pendingFiles.length - 1].id : null;

  const { sentFilesMap, trackFiles } = useSentFiles(messages.length);
  const {
    activeArtifact,
    runtimeState,
    handleManualRetry,
    handleRuntimeEvent,
    handleRequestError,
    handleRequestFinish,
    resetRuntimeState,
  } = useArtifact({
    messages,
    conversationId: conversation.chatConversationId,
    latestFileId,
    chatStatus: status,
    regenerate,
  });
  const { isOpen, setIsOpen, panelWidth, containerRef, handleResizeStart, handleResizeMove, handleResizeEnd } =
    useArtifactPanel(activeArtifact);

  useAutoReply({
    propsConversationId,
    chatConversationId: conversation.chatConversationId,
    messages,
    initialMessages,
    regenerate,
  });

  useEffect(() => {
    setArtifactRequestCallbacks({
      onError: handleRequestError,
      onFinish: handleRequestFinish,
    });
  }, [handleRequestError, handleRequestFinish, setArtifactRequestCallbacks]);

  // Clear input when transitioning from empty state to conversation
  useEffect(() => {
    if (!conversation.isEmptyState) {
      setInput('');
    }
  }, [conversation.isEmptyState, setInput]);

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
  }, [conversation, input, fileUpload, messages.length, rawHandleSend, trackFiles]);

  const handleCloseArtifactPanel = useCallback(() => {
    resetRuntimeState();
    setIsOpen(false);
  }, [resetRuntimeState, setIsOpen]);

  const handleOpenArtifactPanel = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);

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
    return <ChatViewEmptyState creationError={conversation.creationError} composer={composerInput} />;
  }

  return (
    <div className="flex h-full">
      <ChatViewConversationPane
        messages={messages}
        userInitials={userInitials}
        userAvatarUrl={userAvatarUrl}
        sentFilesMap={sentFilesMap}
        isLoading={isLoading}
        error={error}
        composer={composerInput}
        onArtifactClick={handleOpenArtifactPanel}
      />
      <ChatViewArtifactPane
        artifact={activeArtifact}
        isOpen={isOpen}
        panelWidth={panelWidth}
        containerRef={containerRef}
        runtimeState={runtimeState}
        isRetryDisabled={status !== 'ready'}
        onManualRetry={handleManualRetry}
        onRuntimeEvent={handleRuntimeEvent}
        onClose={handleCloseArtifactPanel}
        onResizeStart={handleResizeStart}
        onResizeMove={handleResizeMove}
        onResizeEnd={handleResizeEnd}
      />
    </div>
  );
}
