import type { ReactNode } from 'react';
import { ChatViewMessages } from '@/components/chat/chat-view-messages';
import type { AgentActivityDataChunk, AppUIMessage, UploadedFileData } from '@/types/ai';

interface ChatViewConversationPaneProps {
  readonly messages: readonly AppUIMessage[];
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly isLoading: boolean;
  readonly error: Error | undefined;
  readonly liveActivitiesByToolCallId: ReadonlyMap<string, AgentActivityDataChunk>;
  readonly liveActivityCount: number;
  readonly composer: ReactNode;
  readonly onArtifactClick: () => void;
  readonly onOpenFilePreview: (file: UploadedFileData, trigger: HTMLButtonElement) => void;
}

export function ChatViewConversationPane({
  messages,
  userInitials,
  userAvatarUrl,
  isLoading,
  error,
  liveActivitiesByToolCallId,
  liveActivityCount,
  composer,
  onArtifactClick,
  onOpenFilePreview,
}: ChatViewConversationPaneProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ChatViewMessages
        messages={messages}
        userInitials={userInitials}
        userAvatarUrl={userAvatarUrl}
        isLoading={isLoading}
        error={error}
        liveActivitiesByToolCallId={liveActivitiesByToolCallId}
        liveActivityCount={liveActivityCount}
        onArtifactClick={onArtifactClick}
        onOpenFilePreview={onOpenFilePreview}
      />
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">{composer}</div>
    </div>
  );
}
