'use client';

import { MessageBubble } from '@/components/message/message-bubble';
import { useAutoScroll } from '@/hooks/use-auto-scroll';
import { isAgentActivityDataPart, isAppToolInvocation, isRunningToolInvocation } from '@/lib/agent-activity';
import type { AgentActivityDataChunk, AppUIMessage, UploadedFileData } from '@/types/ai';

interface ChatViewMessagesProps {
  readonly messages: readonly AppUIMessage[];
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly isLoading: boolean;
  readonly error: Error | undefined;
  readonly liveActivitiesByToolCallId: ReadonlyMap<string, AgentActivityDataChunk>;
  readonly liveActivityCount: number;
  readonly onArtifactClick: () => void;
  readonly onOpenFilePreview: (file: UploadedFileData, trigger: HTMLButtonElement) => void;
}

function shouldShowThinking(messages: readonly AppUIMessage[], isLoading: boolean): boolean {
  if (!isLoading || messages.length === 0) {
    return false;
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'assistant') {
    return true;
  }

  return !lastMessage.parts.some((part) => {
    if (part.type === 'text') {
      return part.text.length > 0;
    }

    if (part.type === 'reasoning') {
      return part.text.trim().length > 0;
    }

    if (isAgentActivityDataPart(part)) {
      return part.data.status === 'running' && (part.data.kind === 'tool' || part.data.kind === 'step');
    }

    if (isAppToolInvocation(part)) {
      return !isRunningToolInvocation(part);
    }

    return false;
  });
}

export function ChatViewMessages({
  messages,
  userInitials,
  userAvatarUrl,
  isLoading,
  error,
  liveActivitiesByToolCallId,
  liveActivityCount,
  onArtifactClick,
  onOpenFilePreview,
}: ChatViewMessagesProps) {
  const activityScrollSignal =
    messages.reduce((total, message) => total + (message.role === 'assistant' ? message.parts.length : 0), 0) +
    liveActivityCount;
  const { containerRef, endRef } = useAutoScroll(messages, activityScrollSignal);

  const showThinking = shouldShowThinking(messages, isLoading);
  const lastAssistantMessageId = [...messages].reverse().find((message) => message.role === 'assistant')?.id ?? null;

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {messages.map((message) => (
          <div key={message.id} className="[content-visibility:auto] [contain-intrinsic-size:0_180px]">
            <MessageBubble
              message={message}
              userInitials={userInitials}
              userAvatarUrl={userAvatarUrl}
              onArtifactClick={onArtifactClick}
              onOpenFilePreview={onOpenFilePreview}
              liveActivitiesByToolCallId={
                message.id === lastAssistantMessageId ? liveActivitiesByToolCallId : undefined
              }
            />
          </div>
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
