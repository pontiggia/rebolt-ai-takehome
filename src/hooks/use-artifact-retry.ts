'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ChatStatus } from 'ai';
import type { ActiveArtifact, ArtifactRetrySource, ArtifactRuntimeEvent, ArtifactRuntimeState } from '@/types/chat';
import { MAX_ARTIFACT_AUTO_RETRIES } from '@/types/chat';
import {
  findLatestGenerateArtifactToolError,
  findLatestSuccessfulArtifact,
} from '@/lib/artifact/artifact-message-selectors';
import {
  buildManualRetryPayload,
  buildRuntimeRetryPayload,
  type ArtifactRetryRequestPayload,
  type ChatFinishEvent,
  IDLE_RUNTIME_STATE,
  isDatasetAccessError,
  normalizeErrorMessage,
  type PendingRetry,
  type RetryRequestResult,
  stripDatasetAccessError,
  toRuntimeSource,
} from '@/lib/artifact/artifact-retry';
import { useArtifactToolErrorRetry } from '@/hooks/use-artifact-tool-error-retry';
import type { AppUIMessage } from '@/types/ai';

interface UseArtifactRetryOptions {
  readonly activeArtifactRef: RefObject<ActiveArtifact | null>;
  readonly messages: AppUIMessage[];
  readonly conversationId: string | null;
  readonly latestFileId: string | null;
  readonly chatStatus: ChatStatus;
  readonly regenerate: (options?: { messageId?: string; body?: Record<string, unknown> }) => Promise<void>;
}

interface BufferedRuntimeFailure {
  readonly signature: string;
  readonly payload: ArtifactRetryRequestPayload;
}

export function useArtifactRetry({
  activeArtifactRef,
  messages,
  conversationId,
  latestFileId,
  chatStatus,
  regenerate,
}: UseArtifactRetryOptions) {
  const latestToolError = findLatestGenerateArtifactToolError(messages, latestFileId);
  const [runtimeState, setRuntimeState] = useState<ArtifactRuntimeState>(IDLE_RUNTIME_STATE);

  const pendingRetryRef = useRef<PendingRetry | null>(null);
  const lastRetryPayloadRef = useRef<ArtifactRetryRequestPayload | null>(null);
  const lastToolErrorSignatureRef = useRef<string | null>(null);
  const lastRuntimeErrorSignatureRef = useRef<string | null>(null);
  const bufferedRuntimeFailureRef = useRef<BufferedRuntimeFailure | null>(null);

  const resetForNextArtifact = useCallback(() => {
    pendingRetryRef.current = null;
    lastRetryPayloadRef.current = null;
    lastToolErrorSignatureRef.current = null;
    lastRuntimeErrorSignatureRef.current = null;
    bufferedRuntimeFailureRef.current = null;
    setRuntimeState(IDLE_RUNTIME_STATE);
  }, []);

  const setFailureState = useCallback((error: string, source: ArtifactRetrySource) => {
    setRuntimeState((prev) => ({
      status: prev.retryCount >= MAX_ARTIFACT_AUTO_RETRIES ? 'exhausted' : 'failed',
      retryCount: prev.retryCount,
      lastError: error,
      source,
    }));
  }, []);

  const startValidation = useCallback(() => {
    bufferedRuntimeFailureRef.current = null;
    setRuntimeState((prev) => {
      if (prev.status === 'validating' && prev.lastError === null && prev.source === null) {
        return prev;
      }

      return {
        status: 'validating',
        retryCount: prev.retryCount,
        lastError: null,
        source: null,
      };
    });
  }, []);

  const handleRequestError = useCallback(
    (error: Error) => {
      if (!pendingRetryRef.current) {
        return;
      }

      pendingRetryRef.current = null;
      setFailureState(normalizeErrorMessage(error.message, 'Retry request failed.'), 'request-error');
    },
    [setFailureState],
  );

  const requestRetry = useCallback(
    (
      payload: ArtifactRetryRequestPayload,
      options: { manual?: boolean; resetCount?: boolean } = {},
    ): RetryRequestResult => {
      if (!conversationId || chatStatus !== 'ready' || pendingRetryRef.current) {
        return 'blocked';
      }

      const manual = options.manual ?? false;
      const nextRetryCount = (options.resetCount ? 0 : runtimeState.retryCount) + 1;

      if (!manual && nextRetryCount > MAX_ARTIFACT_AUTO_RETRIES) {
        setRuntimeState({
          status: 'exhausted',
          retryCount: runtimeState.retryCount,
          lastError: payload.error,
          source: payload.source,
        });
        return 'exhausted';
      }

      const retryPayload = {
        ...payload,
        attempt: nextRetryCount,
        manual,
      };

      pendingRetryRef.current = {
        payload: retryPayload,
        baselineArtifactKey: activeArtifactRef.current?.key ?? null,
      };
      lastRetryPayloadRef.current = payload;

      setRuntimeState({
        status: 'retrying',
        retryCount: nextRetryCount,
        lastError: payload.error,
        source: payload.source,
      });

      void regenerate({
        messageId: retryPayload.assistantMessageId,
        body: {
          conversationId,
          artifactRetry: retryPayload,
        },
      }).catch((error) => {
        handleRequestError(error instanceof Error ? error : new Error('Retry request failed.'));
      });

      return 'started';
    },
    [activeArtifactRef, chatStatus, conversationId, handleRequestError, regenerate, runtimeState.retryCount],
  );

  useEffect(() => {
    const bufferedRuntimeFailure = bufferedRuntimeFailureRef.current;
    if (!bufferedRuntimeFailure || chatStatus !== 'ready' || pendingRetryRef.current) {
      return;
    }

    const retryResult = requestRetry(bufferedRuntimeFailure.payload);
    if (retryResult !== 'blocked') {
      lastRuntimeErrorSignatureRef.current = bufferedRuntimeFailure.signature;
      bufferedRuntimeFailureRef.current = null;
    }
  }, [chatStatus, requestRetry]);

  const handleRequestFinish = useCallback(
    ({ messages: finishedMessages, isAbort, isError }: ChatFinishEvent) => {
      const pendingRetry = pendingRetryRef.current;
      if (!pendingRetry || isAbort) {
        return;
      }

      pendingRetryRef.current = null;
      if (isError) {
        return;
      }

      const nextArtifact = findLatestSuccessfulArtifact(finishedMessages);
      if (nextArtifact && nextArtifact.key !== pendingRetry.baselineArtifactKey) {
        return;
      }

      const nextToolError = findLatestGenerateArtifactToolError(finishedMessages, pendingRetry.payload.fileId);
      if (nextToolError) {
        setFailureState(nextToolError.payload.error, nextToolError.payload.source);
        return;
      }

      setFailureState(pendingRetry.payload.error, pendingRetry.payload.source);
    },
    [setFailureState],
  );

  useArtifactToolErrorRetry({
    latestToolError,
    lastToolErrorSignatureRef,
    requestRetry,
  });

  const handleRuntimeEvent = useCallback(
    (event: ArtifactRuntimeEvent, options: { autoRetry?: boolean } = {}) => {
      const artifact = activeArtifactRef.current;
      if (!artifact) {
        return;
      }

      const autoRetry = options.autoRetry ?? true;

      if (event.type === 'ready') {
        lastRuntimeErrorSignatureRef.current = null;
        if (!pendingRetryRef.current) {
          setRuntimeState((prev) => {
            if (prev.status === 'idle' && prev.lastError === null && prev.source === null) {
              return prev;
            }

            return IDLE_RUNTIME_STATE;
          });
        }
        return;
      }

      const error = normalizeErrorMessage(event.message, 'The artifact preview failed.');
      const source = toRuntimeSource(event);
      const signature = `${artifact.key}:${source}:${error}`;

      if (pendingRetryRef.current || signature === lastRuntimeErrorSignatureRef.current) {
        return;
      }

      if (isDatasetAccessError(error)) {
        lastRuntimeErrorSignatureRef.current = signature;
        setRuntimeState((prev) => ({
          status: 'failed',
          retryCount: prev.retryCount,
          lastError: stripDatasetAccessError(error),
          source,
        }));
        return;
      }

      if (!autoRetry) {
        bufferedRuntimeFailureRef.current = null;
        lastRuntimeErrorSignatureRef.current = signature;
        setFailureState(error, source);
        return;
      }

      const retryPayload = buildRuntimeRetryPayload(artifact, error, source);

      if (chatStatus !== 'ready') {
        bufferedRuntimeFailureRef.current = {
          signature,
          payload: retryPayload,
        };
        return;
      }

      const retryResult = requestRetry(retryPayload);
      if (retryResult !== 'blocked') {
        lastRuntimeErrorSignatureRef.current = signature;
      }
    },
    [activeArtifactRef, chatStatus, requestRetry, setFailureState],
  );

  const handleManualRetry = useCallback(() => {
    const artifact = activeArtifactRef.current;
    if (!artifact || chatStatus !== 'ready') {
      return;
    }

    const retryPayload = buildManualRetryPayload(artifact, lastRetryPayloadRef.current, runtimeState);

    lastRuntimeErrorSignatureRef.current = null;
    lastToolErrorSignatureRef.current = null;

    void requestRetry(retryPayload, {
      manual: true,
      resetCount: true,
    });
  }, [activeArtifactRef, chatStatus, requestRetry, runtimeState]);

  return {
    runtimeState,
    startValidation,
    handleManualRetry,
    handleRuntimeEvent,
    handleRequestError,
    handleRequestFinish,
    resetForNextArtifact,
  } as const;
}
