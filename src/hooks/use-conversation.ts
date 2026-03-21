'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { createConversation } from '@/actions/conversations';
import { validateFirstMessageText } from '@/lib/chat/first-message-validation';
import { buildUserMessageParts } from '@/lib/chat/user-message-parts';
import type { MessageResponse } from '@/types/api';
import type { AppUIMessage, UploadedFileData } from '@/types/ai';

const CREATE_CONVERSATION_ERROR_MESSAGE = 'Failed to create conversation. Please try again.';

interface UseConversationOptions {
  readonly propsConversationId?: string;
  readonly initialMessages: readonly MessageResponse[];
}

export function useConversation({ propsConversationId, initialMessages }: UseConversationOptions) {
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [createdMessages, setCreatedMessages] = useState<AppUIMessage[]>([]);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fileConversationId = propsConversationId ?? pendingConversationId;
  const chatConversationId = propsConversationId ?? (createdMessages.length > 0 ? pendingConversationId : null);
  const isEmptyState = !propsConversationId && createdMessages.length === 0;

  const chatMessages: AppUIMessage[] =
    initialMessages.length > 0
      ? initialMessages.map((message) => ({
          id: message.id,
          role: message.role,
          parts: message.parts as AppUIMessage['parts'],
        }))
      : createdMessages;

  const adoptPendingConversation = useCallback((conversationId: string) => {
    setPendingConversationId(conversationId);
    setCreationError(null);
  }, []);

  const createFirstMessage = useCallback(
    (text: string, uploadedFiles: readonly UploadedFileData[] | null, onFilesHandled: () => void) => {
      if (isPending) {
        return;
      }

      const validation = validateFirstMessageText(text);
      if (!validation.ok) {
        setCreationError(validation.error.message);
        return;
      }

      setCreationError(null);
      const messageText = validation.value;
      startTransition(async () => {
        try {
          const result = await createConversation(messageText, pendingConversationId ?? undefined, uploadedFiles ?? []);
          if (!result.ok) {
            setCreationError(result.error.message);
            return;
          }

          const { id, messageId } = result.value;

          setCreatedMessages([
            {
              id: messageId,
              role: 'user' as const,
              parts: buildUserMessageParts(messageText, uploadedFiles ?? []),
            },
          ]);
          setPendingConversationId(id);

          if (uploadedFiles) {
            onFilesHandled();
          }
        } catch {
          setCreationError(CREATE_CONVERSATION_ERROR_MESSAGE);
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
    adoptPendingConversation: propsConversationId ? undefined : adoptPendingConversation,
    createFirstMessage,
  } as const;
}
