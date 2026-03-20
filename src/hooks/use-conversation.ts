'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { UIMessage } from 'ai';
import { createConversation, createConversationOnly } from '@/actions/conversations';
import type { FileMetadataResponse, MessageResponse } from '@/types/api';

interface UseConversationOptions {
  readonly propsConversationId?: string;
  readonly initialMessages: readonly MessageResponse[];
}

export function useConversation({ propsConversationId, initialMessages }: UseConversationOptions) {
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [createdMessages, setCreatedMessages] = useState<UIMessage[]>([]);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fileConversationId = propsConversationId ?? pendingConversationId;
  const chatConversationId = propsConversationId ?? (createdMessages.length > 0 ? pendingConversationId : null);
  const isEmptyState = !propsConversationId && createdMessages.length === 0;

  const chatMessages: UIMessage[] =
    initialMessages.length > 0
      ? initialMessages.map((message) => ({
          id: message.id,
          role: message.role,
          parts: message.parts as UIMessage['parts'],
        }))
      : createdMessages;

  const onConversationNeeded = useCallback(async () => {
    const { id } = await createConversationOnly();
    setPendingConversationId(id);
    return id;
  }, []);

  const createFirstMessage = useCallback(
    (text: string, pendingFiles: readonly FileMetadataResponse[] | null, onFilesHandled: () => void) => {
      if (!text.trim() || isPending) return;
      setCreationError(null);

      const messageText = text.trim();
      startTransition(async () => {
        try {
          const { id, messageId } = await createConversation(messageText, pendingConversationId ?? undefined);

          setCreatedMessages([
            {
              id: messageId,
              role: 'user' as const,
              parts: [{ type: 'text' as const, text: messageText }],
            },
          ]);
          setPendingConversationId(id);

          if (pendingFiles) {
            onFilesHandled();
          }
        } catch (e) {
          setCreationError(e instanceof Error ? e.message : 'Failed to create conversation');
        }
      });
    },
    [isPending, pendingConversationId],
  );

  useEffect(() => {
    if (pendingConversationId && createdMessages.length > 0) {
      window.history.replaceState(null, '', `/chat/${pendingConversationId}`);
    }
  }, [pendingConversationId, createdMessages.length]);

  return {
    chatConversationId,
    fileConversationId,
    chatMessages,
    isPending,
    creationError,
    isEmptyState,
    onConversationNeeded: propsConversationId ? undefined : onConversationNeeded,
    createFirstMessage,
  } as const;
}
