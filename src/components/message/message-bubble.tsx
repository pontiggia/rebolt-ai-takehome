'use client';

import { AssistantMessageBubble } from '@/components/message/assistant-message-bubble';
import { UserMessageBubble } from '@/components/message/user-message-bubble';
import type { FileMetadataResponse } from '@/types/api';
import type { AgentActivityDataChunk, AppUIMessage } from '@/types/ai';

interface MessageBubbleProps {
  readonly message: AppUIMessage;
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly files?: readonly FileMetadataResponse[];
  readonly onArtifactClick?: () => void;
  readonly liveActivitiesByToolCallId?: ReadonlyMap<string, AgentActivityDataChunk>;
}

export function MessageBubble({
  message,
  userInitials,
  userAvatarUrl,
  files,
  onArtifactClick,
  liveActivitiesByToolCallId,
}: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <UserMessageBubble message={message} userInitials={userInitials} userAvatarUrl={userAvatarUrl} files={files} />
    );
  }

  return (
    <AssistantMessageBubble
      message={message}
      onArtifactClick={onArtifactClick}
      liveActivitiesByToolCallId={liveActivitiesByToolCallId}
    />
  );
}
