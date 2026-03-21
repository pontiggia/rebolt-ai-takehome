'use client';

import { AssistantMessageBubble } from '@/components/message/assistant-message-bubble';
import { UserMessageBubble } from '@/components/message/user-message-bubble';
import type { AgentActivityDataChunk, AppUIMessage, UploadedFileData } from '@/types/ai';

interface MessageBubbleProps {
  readonly message: AppUIMessage;
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly activeArtifactKey?: string | null;
  readonly activeArtifactStatusLabel?: string | null;
  readonly onArtifactClick?: () => void;
  readonly onOpenFilePreview?: (file: UploadedFileData, trigger: HTMLButtonElement) => void;
  readonly liveActivitiesByToolCallId?: ReadonlyMap<string, AgentActivityDataChunk>;
}

export function MessageBubble({
  message,
  userInitials,
  userAvatarUrl,
  activeArtifactKey,
  activeArtifactStatusLabel,
  onArtifactClick,
  onOpenFilePreview,
  liveActivitiesByToolCallId,
}: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <UserMessageBubble
        message={message}
        userInitials={userInitials}
        userAvatarUrl={userAvatarUrl}
        onOpenFilePreview={onOpenFilePreview}
      />
    );
  }

  return (
    <AssistantMessageBubble
      message={message}
      activeArtifactKey={activeArtifactKey}
      activeArtifactStatusLabel={activeArtifactStatusLabel}
      onArtifactClick={onArtifactClick}
      liveActivitiesByToolCallId={liveActivitiesByToolCallId}
    />
  );
}
