'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ChatStatus } from 'ai';
import { useArtifactActiveState } from '@/hooks/use-artifact-active-state';
import { useArtifactRetry } from '@/hooks/use-artifact-retry';
import { findLatestSuccessfulArtifact } from '@/lib/artifact/artifact-message-selectors';
import type { AppUIMessage } from '@/types/ai';

interface UseArtifactOptions {
  readonly messages: AppUIMessage[];
  readonly conversationId: string | null;
  readonly latestFileId: string | null;
  readonly chatStatus: ChatStatus;
  readonly regenerate: (options?: { messageId?: string; body?: Record<string, unknown> }) => Promise<void>;
}

export function useArtifact({ messages, conversationId, latestFileId, chatStatus, regenerate }: UseArtifactOptions) {
  const latestSuccessfulArtifact = findLatestSuccessfulArtifact(messages);
  const onArtifactReplaceRef = useRef<() => void>(() => {});
  const handleArtifactReplace = useCallback(() => {
    onArtifactReplaceRef.current();
  }, []);

  const { activeArtifact, activeArtifactRef } = useArtifactActiveState({
    latestSuccessfulArtifact,
    onArtifactReplace: handleArtifactReplace,
  });

  const {
    runtimeState,
    handleManualRetry,
    handleRuntimeEvent,
    handleRequestError,
    handleRequestFinish,
    resetForNextArtifact,
    resetRuntimeState,
  } = useArtifactRetry({
    activeArtifactRef,
    messages,
    conversationId,
    latestFileId,
    chatStatus,
    regenerate,
  });

  useEffect(() => {
    onArtifactReplaceRef.current = resetForNextArtifact;
  }, [resetForNextArtifact]);

  return {
    activeArtifact,
    runtimeState,
    handleManualRetry,
    handleRuntimeEvent,
    handleRequestError,
    handleRequestFinish,
    resetRuntimeState,
  } as const;
}
