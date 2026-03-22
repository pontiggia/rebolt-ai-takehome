'use client';

import { useChat } from '@ai-sdk/react';
import type { ChatOnDataCallback, ChatOnErrorCallback, ChatOnFinishCallback } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';
import { buildUserMessageParts } from '@/lib/chat/user-message-parts';
import type { AppUIMessage, UploadedFileData } from '@/types/ai';

const PLACEHOLDER_ID = '__pending__';
const CHAT_UPDATE_THROTTLE_MS = 50;

interface UseAppChatOptions {
  readonly onError?: ChatOnErrorCallback;
  readonly onFinish?: ChatOnFinishCallback<AppUIMessage>;
  readonly onData?: ChatOnDataCallback<AppUIMessage>;
}

export function useAppChat(
  conversationId: string | null,
  initialMessages: AppUIMessage[],
  options: UseAppChatOptions = {},
) {
  const [input, setInput] = useState('');
  const effectiveId = conversationId ?? PLACEHOLDER_ID;

  const chat = useChat<AppUIMessage>({
    id: effectiveId,
    messages: initialMessages,
    onData: options.onData,
    onError: options.onError,
    onFinish: options.onFinish,
    experimental_throttle: CHAT_UPDATE_THROTTLE_MS,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { conversationId: effectiveId },
    }),
  });

  const handleSend = (uploadedFiles: readonly UploadedFileData[] = []) => {
    const messageText = input.trim();
    if (!messageText || !conversationId) return;
    chat.sendMessage({
      parts: buildUserMessageParts(messageText, uploadedFiles),
    });
    setInput('');
  };

  const isLoading = chat.status === 'submitted' || chat.status === 'streaming';

  return {
    messages: chat.messages,
    status: chat.status,
    isLoading,
    regenerate: chat.regenerate,
    error: chat.error,
    input,
    setInput,
    handleSend,
  };
}
