'use client';

import type { UIMessage } from 'ai';
import { MessageBubble } from '@/components/message/message-bubble';
import { useAutoScroll } from '@/hooks/use-auto-scroll';
import type { FileMetadataResponse } from '@/types/api';

interface ChatViewMessagesProps {
  readonly messages: readonly UIMessage[];
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly sentFilesMap: ReadonlyMap<number, readonly FileMetadataResponse[]>;
  readonly isLoading: boolean;
  readonly error: Error | undefined;
  readonly onArtifactClick: () => void;
}

function shouldShowThinking(messages: readonly UIMessage[], isLoading: boolean): boolean {
  if (!isLoading || messages.length === 0) {
    return false;
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'assistant') {
    return true;
  }

  return !lastMessage.parts.some(
    (part) => (part.type === 'text' && part.text.length > 0) || part.type.startsWith('tool-'),
  );
}

export function ChatViewMessages({
  messages,
  userInitials,
  userAvatarUrl,
  sentFilesMap,
  isLoading,
  error,
  onArtifactClick,
}: ChatViewMessagesProps) {
  const { containerRef, endRef } = useAutoScroll(messages);

  const showThinking = shouldShowThinking(messages, isLoading);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            userInitials={userInitials}
            userAvatarUrl={userAvatarUrl}
            files={sentFilesMap.get(index)}
            onArtifactClick={onArtifactClick}
          />
        ))}
        {showThinking && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-pulse">●</span> Thinking...
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        <div ref={endRef} />
      </div>
    </div>
  );
}
