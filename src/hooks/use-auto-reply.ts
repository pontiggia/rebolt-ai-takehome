'use client';

import { useEffect, useRef } from 'react';
import type { MessageResponse } from '@/types/api';
import type { AppUIMessage } from '@/types/ai';

interface UseAutoReplyOptions {
  readonly propsConversationId?: string;
  readonly chatConversationId: string | null;
  readonly messages: AppUIMessage[];
  readonly initialMessages: readonly MessageResponse[];
  readonly regenerate: () => void;
}

export function useAutoReply({
  propsConversationId,
  chatConversationId,
  messages,
  initialMessages,
  regenerate,
}: UseAutoReplyOptions) {
  const hasTriggeredInitialReply = useRef(false);
  const prevChatIdRef = useRef(chatConversationId);
  const needsInitialAssistantReply =
    initialMessages.length > 0 && initialMessages[initialMessages.length - 1]?.role === 'user';

  useEffect(() => {
    if (!needsInitialAssistantReply || hasTriggeredInitialReply.current) return;
    hasTriggeredInitialReply.current = true;
    void regenerate();
  }, [needsInitialAssistantReply, regenerate]);

  useEffect(() => {
    if (
      !propsConversationId &&
      chatConversationId &&
      prevChatIdRef.current !== chatConversationId &&
      messages.length > 0 &&
      messages[messages.length - 1].role === 'user'
    ) {
      void regenerate();
    }
    prevChatIdRef.current = chatConversationId;
  }, [chatConversationId, propsConversationId, messages, regenerate]);
}
