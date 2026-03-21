'use client';

import { startTransition, useCallback, useState } from 'react';
import type { ChatStatus } from 'ai';
import { getRunningToolCallIds } from '@/lib/agent-activity';
import type { AgentActivityDataChunk, AppUIMessage } from '@/types/ai';

type LiveAgentActivityMap = Record<string, AgentActivityDataChunk>;

function isTransientActivityPart(dataPart: unknown): dataPart is AgentActivityDataChunk {
  if (!dataPart || typeof dataPart !== 'object') {
    return false;
  }

  const candidate = dataPart as {
    type?: unknown;
    id?: unknown;
    transient?: unknown;
    data?: unknown;
  };
  const candidateData = candidate.data;

  return (
    candidate.type === 'data-agent-activity' &&
    candidateData !== null &&
    typeof candidateData === 'object' &&
    'kind' in candidateData &&
    candidateData.kind === 'tool-internal' &&
    candidate.transient === true
  );
}

export function useLiveAgentActivity() {
  const [liveActivitiesById, setLiveActivitiesById] = useState<LiveAgentActivityMap>({});

  const handleData = useCallback((dataPart: unknown) => {
    if (!isTransientActivityPart(dataPart) || !dataPart.id) {
      return;
    }

    startTransition(() => {
      setLiveActivitiesById((prev) => ({
        ...prev,
        [dataPart.id!]: dataPart,
      }));
    });
  }, []);

  const syncForChatState = useCallback((messages: readonly AppUIMessage[], status: ChatStatus) => {
    startTransition(() => {
      setLiveActivitiesById((prev) => {
        if (status === 'ready' || status === 'error') {
          return {};
        }

        const activeToolCallIds = getRunningToolCallIds(messages);
        const nextEntries = Object.entries(prev).filter(([, activity]) => {
          const toolCallId = activity.data.toolCallId;
          return toolCallId ? activeToolCallIds.has(toolCallId) : false;
        });

        if (nextEntries.length === Object.keys(prev).length) {
          return prev;
        }

        return Object.fromEntries(nextEntries);
      });
    });
  }, []);

  const liveActivitiesByToolCallId = new Map<string, AgentActivityDataChunk>();
  for (const activity of Object.values(liveActivitiesById)) {
    if (activity.data.toolCallId) {
      liveActivitiesByToolCallId.set(activity.data.toolCallId, activity);
    }
  }

  return {
    handleData,
    syncForChatState,
    liveActivitiesByToolCallId,
    liveActivityCount: Object.keys(liveActivitiesById).length,
  } as const;
}
