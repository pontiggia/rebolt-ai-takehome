import type { ReactNode } from 'react';
import type { UIMessage } from 'ai';
import { ChatViewMessages } from '@/components/chat/chat-view-messages';
import type { FileMetadataResponse } from '@/types/api';

interface ChatViewConversationPaneProps {
  readonly messages: readonly UIMessage[];
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly sentFilesMap: ReadonlyMap<number, readonly FileMetadataResponse[]>;
  readonly isLoading: boolean;
  readonly error: Error | undefined;
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
        onArtifactClick={onArtifactClick}
      />
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">{composer}</div>
    </div>
  );
}
