'use client';

import { useRef, useEffect, useState } from 'react';
import { useAppChat } from '@/hooks/use-app-chat';
import { MessageBubble } from '@/components/message-bubble';
import { MessageInput } from '@/components/message-input';
import { ArtifactPanel } from '@/components/artifact-panel';
import type { ArtifactToolOutput } from '@/types/ai';
import type { ArtifactState } from '@/types/chat';
import type { FileMetadataResponse, MessageResponse } from '@/types/api';

interface ChatPanelProps {
  readonly conversationId: string;
  readonly initialMessages: readonly MessageResponse[];
  readonly initialFiles: readonly FileMetadataResponse[];
}

export function ChatPanel({ conversationId, initialMessages, initialFiles }: ChatPanelProps) {
  const chatMessages = initialMessages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts,
  }));
  const { messages, isLoading, input, setInput, handleSend, sendMessage, regenerate, error } = useAppChat(
    conversationId,
    chatMessages,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasTriggeredInitialReply = useRef(false);
  const needsInitialAssistantReply =
    initialMessages.length > 0 && initialMessages[initialMessages.length - 1]?.role === 'user';
  const [artifactState, setArtifactState] = useState<ArtifactState>({
    code: null,
    error: null,
    retryCount: 0,
  });

  // Derive latest artifact from typed tool parts
  let latestArtifact: ArtifactToolOutput | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts ?? []) {
      if (part.type === 'tool-generateArtifact' && part.state === 'output-available') {
        latestArtifact = part.output as ArtifactToolOutput;
        break;
      }
    }
    if (latestArtifact) break;
  }

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!needsInitialAssistantReply || hasTriggeredInitialReply.current) return;

    hasTriggeredInitialReply.current = true;
    void regenerate();
  }, [needsInitialAssistantReply, regenerate]);

  const handleFixError = () => {
    if (!artifactState.error) return;
    setArtifactState((prev) => ({
      ...prev,
      retryCount: prev.retryCount + 1,
    }));
    sendMessage({
      text: `The artifact produced this error: ${artifactState.error}. Please fix the code.`,
    });
  };

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="animate-pulse">●</span> Thinking...
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error.message}</p>}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <MessageInput
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          isLoading={isLoading}
          conversationId={conversationId}
          files={initialFiles}
        />
      </div>
      {latestArtifact && (
        <ArtifactPanel
          title={latestArtifact.title}
          code={latestArtifact.code}
          error={artifactState.error}
          retryCount={artifactState.retryCount}
          onFixError={handleFixError}
        />
      )}
    </div>
  );
}
