'use client';

import useSWR from 'swr';
import type { ConversationSummary } from '@/types/api';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useConversations() {
  const { data, error, isLoading, mutate } = useSWR<ConversationSummary[]>('/api/conversations', fetcher);

  return {
    conversations: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
