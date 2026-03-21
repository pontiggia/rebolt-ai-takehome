import type { ReactNode } from 'react';
import { ChatViewMessages } from '@/components/chat/chat-view-messages';
import type { FileMetadataResponse } from '@/types/api';
import type { AgentActivityDataChunk, AppUIMessage } from '@/types/ai';

interface ChatViewConversationPaneProps {
  readonly messages: readonly AppUIMessage[];
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly sentFilesMap: ReadonlyMap<number, readonly FileMetadataResponse[]>;
  readonly isLoading: boolean;
  readonly error: Error | undefined;
  readonly liveActivitiesByToolCallId: ReadonlyMap<string, AgentActivityDataChunk>;
  readonly liveActivityCount: number;
  readonly composer: ReactNode;
  readonly onArtifactClick: () => void;
}

export function ChatViewConversationPane({
  messages,
  userInitials,
  userAvatarUrl,
  sentFilesMap,
  isLoading,
  error,
  liveActivitiesByToolCallId,
  liveActivityCount,
  composer,
  onArtifactClick,
}: ChatViewConversationPaneProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ChatViewMessages
        messages={messages}
        userInitials={userInitials}
        userAvatarUrl={userAvatarUrl}
        sentFilesMap={sentFilesMap}
        isLoading={isLoading}
        error={error}
        liveActivitiesByToolCallId={liveActivitiesByToolCallId}
        liveActivityCount={liveActivityCount}
        onArtifactClick={onArtifactClick}
      />
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">{composer}</div>
    </div>
  );
}
