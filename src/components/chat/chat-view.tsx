'use client';

import dynamic from 'next/dynamic';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listSuccessfulArtifactKeys } from '@/lib/artifact/artifact-message-selectors';
import { toUploadedFileData, getUploadedFileRefs } from '@/lib/chat/user-message-parts';
import { useAppChat } from '@/hooks/use-app-chat';
import { useArtifactRequestRelay } from '@/hooks/use-artifact-request-relay';
import { useConversation } from '@/hooks/use-conversation';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useFilePreview } from '@/hooks/use-file-preview';
import { useAutoReply } from '@/hooks/use-auto-reply';
import { useArtifact } from '@/hooks/use-artifact';
import { useArtifactPanel } from '@/hooks/use-artifact-panel';
import { useLiveAgentActivity } from '@/hooks/use-live-agent-activity';
import { ChatViewArtifactPane } from '@/components/chat/chat-view-artifact-pane';
import { ChatViewConversationPane } from '@/components/chat/chat-view-conversation-pane';
import { ChatViewEmptyState } from '@/components/chat/chat-view-empty-state';
import { ComposerInput } from '@/components/chat/composer-input';
import { FilePreviewDialog } from '@/components/chat/file-preview-dialog';
import type { MessageResponse } from '@/types/api';
import type { AppUIMessage, UploadedFileData } from '@/types/ai';

const ArtifactBackgroundValidator = dynamic(
  () => import('@/components/artifact/artifact-background-validator').then((m) => m.ArtifactBackgroundValidator),
  {
    ssr: false,
    loading: () => null,
  },
);

interface ChatViewProps {
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly conversationId?: string;
  readonly initialMessages?: readonly MessageResponse[];
}

export function ChatView({
  userInitials,
  userAvatarUrl,
  conversationId: propsConversationId,
  initialMessages = [],
}: ChatViewProps) {
  const router = useRouter();
  const conversation = useConversation({ propsConversationId, initialMessages });
  const historicalArtifactKeys = useMemo(
    () =>
      new Set(
        listSuccessfulArtifactKeys(
          initialMessages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts as AppUIMessage['parts'],
          })),
        ),
      ),
    [initialMessages],
  );
  const {
    handleData: handleAgentActivityData,
    syncForChatState,
    liveActivitiesByToolCallId,
    liveActivityCount,
  } = useLiveAgentActivity();
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
    onData: handleAgentActivityData,
    onError: relayArtifactError,
    onFinish: relayArtifactFinish,
  });

  const handleConversationAdopted = useCallback(
    (conversationId: string) => {
      conversation.adoptPendingConversation?.(conversationId);
      startTransition(() => {
        router.refresh();
      });
    },
    [conversation, router],
  );

  const fileUpload = useFileUpload({
    conversationId: conversation.fileConversationId,
    onConversationAdopted: conversation.adoptPendingConversation ? handleConversationAdopted : undefined,
  });
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { preview, isLoading: isPreviewLoading, error: previewError, loadPreview, resetPreview } = useFilePreview();

  const latestFileId =
    fileUpload.pendingFiles.length > 0 ? fileUpload.pendingFiles[fileUpload.pendingFiles.length - 1].id : null;

  const {
    activeArtifact,
    activeArtifactStatusLabel,
    runtimeState,
    shouldValidateActiveArtifact,
    handleManualRetry,
    handleRuntimeEvent,
    handleRequestError,
    handleRequestFinish,
  } = useArtifact({
    messages,
    historicalArtifactKeys,
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

  useEffect(() => {
    syncForChatState(messages, status);
  }, [messages, status, syncForChatState]);

  // Clear input when transitioning from empty state to conversation
  useEffect(() => {
    if (!conversation.isEmptyState) {
      setInput('');
    }
  }, [conversation.isEmptyState, setInput]);

  const selectedFile =
    selectedFileId === null
      ? null
      : (messages
          .flatMap((message) => getUploadedFileRefs(message.parts))
          .find((file) => file.fileId === selectedFileId) ?? null);

  const handleSend = useCallback(() => {
    const uploadedFiles = fileUpload.pendingFiles.map(toUploadedFileData);
    const hasUploadedFiles = uploadedFiles.length > 0;

    if (conversation.isEmptyState) {
      conversation.createFirstMessage(input, hasUploadedFiles ? uploadedFiles : null, () => {
        fileUpload.clearFiles();
      });
      return;
    }

    if (hasUploadedFiles) {
      fileUpload.clearFiles();
    }
    rawHandleSend(uploadedFiles);
  }, [conversation, fileUpload, input, rawHandleSend]);

  const handleOpenFilePreview = useCallback(
    (file: UploadedFileData, trigger: HTMLButtonElement) => {
      previewTriggerRef.current = trigger;
      setSelectedFileId(file.fileId);
      void loadPreview(file.fileId);
    },
    [loadPreview],
  );

  const handlePreviewOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }

      setSelectedFileId(null);
      resetPreview();
    },
    [resetPreview],
  );

  const handleCloseArtifactPanel = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

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
        activeArtifactKey={activeArtifact?.key ?? null}
        activeArtifactStatusLabel={activeArtifactStatusLabel}
        isLoading={isLoading}
        error={error}
        liveActivitiesByToolCallId={liveActivitiesByToolCallId}
        liveActivityCount={liveActivityCount}
        composer={composerInput}
        onArtifactClick={handleOpenArtifactPanel}
        onOpenFilePreview={handleOpenFilePreview}
      />
      {activeArtifact && !isOpen && shouldValidateActiveArtifact ? (
        <ArtifactBackgroundValidator
          artifactKey={activeArtifact.key}
          files={activeArtifact.files}
          onRuntimeEvent={handleRuntimeEvent}
        />
      ) : null}
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
      <FilePreviewDialog
        open={selectedFileId !== null}
        fileName={selectedFile?.fileName ?? null}
        preview={preview}
        isLoading={isPreviewLoading}
        error={previewError}
        triggerRef={previewTriggerRef}
        onOpenChange={handlePreviewOpenChange}
      />
    </div>
  );
}
