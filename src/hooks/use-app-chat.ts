'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export function useAppChat(conversationId: string, initialMessages: UIMessage[]) {
  const [input, setInput] = useState('');

  const chat = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { conversationId },
    }),
  });

  const handleSend = () => {
    if (!input.trim()) return;
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
