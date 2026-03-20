'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

const PLACEHOLDER_ID = '__pending__';

export function useAppChat(conversationId: string | null, initialMessages: UIMessage[]) {
  const [input, setInput] = useState('');
  const effectiveId = conversationId ?? PLACEHOLDER_ID;

  const chat = useChat({
    id: effectiveId,
    messages: initialMessages,
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
    error: chat.error,
    input,
    setInput,
    handleSend,
  };
}
