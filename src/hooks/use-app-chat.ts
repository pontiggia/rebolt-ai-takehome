'use client';

import { useChat } from '@ai-sdk/react';
import type { ChatOnErrorCallback, ChatOnFinishCallback, UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

const PLACEHOLDER_ID = '__pending__';

interface UseAppChatOptions {
  readonly onError?: ChatOnErrorCallback;
  readonly onFinish?: ChatOnFinishCallback<UIMessage>;
}

export function useAppChat(
  conversationId: string | null,
  initialMessages: UIMessage[],
  options: UseAppChatOptions = {},
) {
  const [input, setInput] = useState('');
  const effectiveId = conversationId ?? PLACEHOLDER_ID;

  const chat = useChat({
    id: effectiveId,
    messages: initialMessages,
    onError: options.onError,
    onFinish: options.onFinish,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { conversationId: effectiveId },
    }),
  });

  const handleSend = () => {
    if (!input.trim() || !conversationId) return;
    chat.sendMessage({ text: input });
    setInput('');
  };

  const isLoading = chat.status === 'submitted' || chat.status === 'streaming';

  return {
    messages: chat.messages,
    status: chat.status,
    isLoading,
    sendMessage: chat.sendMessage,
    regenerate: chat.regenerate,
    clearError: chat.clearError,
    error: chat.error,
    input,
    setInput,
    handleSend,
  };
}
