'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatStatus } from 'ai';
import { useArtifactActiveState } from '@/hooks/use-artifact-active-state';
import { useArtifactRetry } from '@/hooks/use-artifact-retry';
import { findLatestSuccessfulArtifact } from '@/lib/artifact/artifact-message-selectors';
import type { AppUIMessage } from '@/types/ai';
import type { ArtifactRuntimeEvent, ArtifactRuntimeStatus } from '@/types/chat';

interface UseArtifactOptions {
  readonly messages: AppUIMessage[];
  readonly historicalArtifactKeys: ReadonlySet<string>;
  readonly conversationId: string | null;
  readonly latestFileId: string | null;
  readonly chatStatus: ChatStatus;
  readonly regenerate: (options?: { messageId?: string; body?: Record<string, unknown> }) => Promise<void>;
}

function getActiveArtifactStatusLabel(status: ArtifactRuntimeStatus): string | null {
  switch (status) {
    case 'validating':
      return 'Validating artifact...';
    case 'retrying':
      return 'Self-correcting...';
    case 'failed':
    case 'exhausted':
      return 'Validation failed';
    default:
      return null;
  }
}

export function useArtifact({
  messages,
  historicalArtifactKeys,
  conversationId,
  latestFileId,
  chatStatus,
  regenerate,
}: UseArtifactOptions) {
  const latestSuccessfulArtifact = findLatestSuccessfulArtifact(messages);
  const [validatedArtifactKeys, setValidatedArtifactKeys] = useState(() => new Set<string>());
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
    startValidation,
    handleManualRetry,
    handleRuntimeEvent: handleRetryRuntimeEvent,
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

  const activeArtifactKey = activeArtifact?.key ?? null;
  const isArtifactEligibleForAutoValidation = useCallback(
    (artifactKey: string) => !historicalArtifactKeys.has(artifactKey) && !validatedArtifactKeys.has(artifactKey),
    [historicalArtifactKeys, validatedArtifactKeys],
  );
  const shouldAutoValidateActiveArtifact =
    activeArtifactKey !== null && isArtifactEligibleForAutoValidation(activeArtifactKey);

  useEffect(() => {
    if (!activeArtifact || !shouldAutoValidateActiveArtifact || chatStatus !== 'ready' || runtimeState.status !== 'idle') {
      return;
    }

    startValidation();
  }, [activeArtifact, chatStatus, runtimeState.status, shouldAutoValidateActiveArtifact, startValidation]);

  const handleRuntimeEvent = useCallback(
    (event: ArtifactRuntimeEvent) => {
      const artifactKey = activeArtifactRef.current?.key ?? null;
      const shouldAutoRetry = artifactKey !== null && isArtifactEligibleForAutoValidation(artifactKey);

      if (event.type === 'ready' && artifactKey && shouldAutoRetry) {
        setValidatedArtifactKeys((current) => {
          if (current.has(artifactKey)) {
            return current;
          }

          const next = new Set(current);
          next.add(artifactKey);
          return next;
        });
      }

      handleRetryRuntimeEvent(event, { autoRetry: shouldAutoRetry });
    },
    [activeArtifactRef, handleRetryRuntimeEvent, isArtifactEligibleForAutoValidation],
  );

  const shouldValidateActiveArtifact =
    activeArtifact !== null &&
    shouldAutoValidateActiveArtifact &&
    (runtimeState.status === 'idle' || runtimeState.status === 'validating');

  return {
    activeArtifact,
    activeArtifactStatusLabel: activeArtifact ? getActiveArtifactStatusLabel(runtimeState.status) : null,
    runtimeState,
    shouldValidateActiveArtifact,
    handleManualRetry,
    handleRuntimeEvent,
    handleRequestError,
    handleRequestFinish,
    resetRuntimeState,
  } as const;
}
