'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatOnFinishCallback, ChatStatus, UIMessage } from 'ai';
import type { ArtifactToolInput, ArtifactToolOutput } from '@/types/ai';
import type {
  ActiveArtifact,
  ArtifactRetryPayload,
  ArtifactRetrySource,
  ArtifactRuntimeEvent,
  ArtifactRuntimeState,
} from '@/types/chat';
import { MAX_ARTIFACT_AUTO_RETRIES } from '@/types/chat';

const IDLE_RUNTIME_STATE: ArtifactRuntimeState = {
  status: 'idle',
  retryCount: 0,
  lastError: null,
  source: null,
};

type RetryRequestResult = 'started' | 'blocked' | 'exhausted';

type GenerateArtifactPart = {
  type: 'tool-generateArtifact';
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

interface GenerateArtifactToolError {
  readonly signature: string;
  readonly payload: Omit<ArtifactRetryPayload, 'attempt' | 'manual'>;
}

interface PendingRetry {
  readonly payload: ArtifactRetryPayload;
  readonly baselineArtifactKey: string | null;
}

interface UseArtifactOptions {
  readonly messages: UIMessage[];
  readonly conversationId: string | null;
  readonly chatStatus: ChatStatus;
  readonly regenerate: (options?: { messageId?: string; body?: Record<string, unknown> }) => Promise<void>;
}

function normalizeErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (value && typeof value === 'object') {
    const errorLike = value as Partial<Record<'message' | 'title' | 'description', unknown>>;
    for (const key of ['message', 'title', 'description'] as const) {
      const candidate = errorLike[key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return fallback;
}

function getGenerateArtifactPart(part: UIMessage['parts'][number]): GenerateArtifactPart | null {
  return part.type === 'tool-generateArtifact' ? (part as GenerateArtifactPart) : null;
}

function findLatestSuccessfulArtifact(messages: readonly UIMessage[]): ActiveArtifact | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'assistant') {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = getGenerateArtifactPart(message.parts[partIndex]);
      if (!part || part.state !== 'output-available' || !part.output) {
        continue;
      }

      const output = part.output as ArtifactToolOutput;
      const input = part.input as ArtifactToolInput | undefined;
      return {
        key: `${message.id}:${part.toolCallId}`,
        assistantMessageId: message.id,
        toolCallId: part.toolCallId,
        title: output.title ?? input?.title ?? null,
        description: input?.description ?? null,
        files: output.files,
      };
    }
  }

  return null;
}

function findLatestGenerateArtifactToolError(messages: readonly UIMessage[]): GenerateArtifactToolError | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'assistant') {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = getGenerateArtifactPart(message.parts[partIndex]);
      if (!part || part.state !== 'output-error' || !part.errorText) {
        continue;
      }

      const error = normalizeErrorMessage(part.errorText, 'Artifact generation failed.');
      const input = part.input as ArtifactToolInput | undefined;
      return {
        signature: `${message.id}:${part.toolCallId}:${error}`,
        payload: {
          assistantMessageId: message.id,
          artifactToolCallId: part.toolCallId,
          artifactTitle: input?.title ?? null,
          artifactDescription: input?.description ?? null,
          files: null,
          error,
          source: 'tool-output-error',
        },
      };
    }
  }

  return null;
}

function toRuntimeSource(event: Exclude<ArtifactRuntimeEvent, { type: 'ready' }>): ArtifactRetrySource {
  if (event.type === 'timeout') {
    return 'sandpack-timeout';
  }

  if (event.type === 'notification-error') {
    return 'sandpack-notification';
  }

  return 'sandpack-runtime';
}

type ChatFinishEvent = Parameters<ChatOnFinishCallback<UIMessage>>[0];

export function useArtifact({ messages, conversationId, chatStatus, regenerate }: UseArtifactOptions) {
  const latestSuccessfulArtifact = findLatestSuccessfulArtifact(messages);
  const latestToolError = findLatestGenerateArtifactToolError(messages);

  const [activeArtifact, setActiveArtifact] = useState<ActiveArtifact | null>(() => latestSuccessfulArtifact);
  const [runtimeState, setRuntimeState] = useState<ArtifactRuntimeState>(IDLE_RUNTIME_STATE);

  const activeArtifactRef = useRef(activeArtifact);
  const pendingRetryRef = useRef<PendingRetry | null>(null);
  const lastRetryPayloadRef = useRef<ArtifactRetryPayload | null>(null);
  const lastToolErrorSignatureRef = useRef<string | null>(null);
  const lastRuntimeErrorSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    activeArtifactRef.current = activeArtifact;
  }, [activeArtifact]);

  useEffect(() => {
    if (!latestSuccessfulArtifact || activeArtifactRef.current?.key === latestSuccessfulArtifact.key) {
      return;
    }

    let cancelled = false;
    pendingRetryRef.current = null;
    lastRetryPayloadRef.current = null;
    lastToolErrorSignatureRef.current = null;
    lastRuntimeErrorSignatureRef.current = null;
    activeArtifactRef.current = latestSuccessfulArtifact;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setActiveArtifact(latestSuccessfulArtifact);
      setRuntimeState(IDLE_RUNTIME_STATE);
    });

    return () => {
      cancelled = true;
    };
  }, [latestSuccessfulArtifact]);

  const setFailureState = useCallback((error: string, source: ArtifactRetrySource) => {
    setRuntimeState((prev) => ({
      status: prev.retryCount >= MAX_ARTIFACT_AUTO_RETRIES ? 'exhausted' : 'failed',
      retryCount: prev.retryCount,
      lastError: error,
      source,
    }));
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
      payload: Omit<ArtifactRetryPayload, 'attempt' | 'manual'>,
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

      const retryPayload: ArtifactRetryPayload = {
        ...payload,
        attempt: nextRetryCount,
        manual,
      };

      pendingRetryRef.current = {
        payload: retryPayload,
        baselineArtifactKey: activeArtifactRef.current?.key ?? null,
      };
      lastRetryPayloadRef.current = retryPayload;

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
    [chatStatus, conversationId, handleRequestError, regenerate, runtimeState.retryCount],
  );

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

      const nextToolError = findLatestGenerateArtifactToolError(finishedMessages);
      if (nextToolError) {
        setFailureState(nextToolError.payload.error, nextToolError.payload.source);
        return;
      }

      setFailureState(pendingRetry.payload.error, pendingRetry.payload.source);
    },
    [setFailureState],
  );

  useEffect(() => {
    if (!latestToolError || latestToolError.signature === lastToolErrorSignatureRef.current) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const retryResult = requestRetry(latestToolError.payload);
      if (retryResult !== 'blocked') {
        lastToolErrorSignatureRef.current = latestToolError.signature;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [latestToolError, requestRetry]);

  const handleRuntimeEvent = useCallback(
    (event: ArtifactRuntimeEvent) => {
      const artifact = activeArtifactRef.current;
      if (!artifact) {
        return;
      }

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

      const retryResult = requestRetry({
        assistantMessageId: artifact.assistantMessageId,
        artifactToolCallId: artifact.toolCallId,
        artifactTitle: artifact.title,
        artifactDescription: artifact.description,
        files: artifact.files,
        error,
        source,
      });

      if (retryResult !== 'blocked') {
        lastRuntimeErrorSignatureRef.current = signature;
      }
    },
    [requestRetry],
  );

  const handleManualRetry = useCallback(() => {
    const artifact = activeArtifactRef.current;
    if (!artifact || chatStatus !== 'ready') {
      return;
    }

    const previousRetry = lastRetryPayloadRef.current;
    const retryPayload =
      previousRetry &&
      previousRetry.assistantMessageId === artifact.assistantMessageId &&
      previousRetry.artifactToolCallId === artifact.toolCallId
        ? {
            assistantMessageId: previousRetry.assistantMessageId,
            artifactToolCallId: previousRetry.artifactToolCallId,
            artifactTitle: previousRetry.artifactTitle,
            artifactDescription: previousRetry.artifactDescription,
            files: previousRetry.files,
            error: previousRetry.error,
            source: previousRetry.source,
          }
        : {
            assistantMessageId: artifact.assistantMessageId,
            artifactToolCallId: artifact.toolCallId,
            artifactTitle: artifact.title,
            artifactDescription: artifact.description,
            files: artifact.files,
            error: runtimeState.lastError ?? 'The artifact preview failed.',
            source: runtimeState.source ?? 'sandpack-runtime',
          };

    lastRuntimeErrorSignatureRef.current = null;
    lastToolErrorSignatureRef.current = null;

    void requestRetry(retryPayload, {
      manual: true,
      resetCount: true,
    });
  }, [chatStatus, requestRetry, runtimeState.lastError, runtimeState.source]);

  const resetRuntimeState = useCallback(() => {
    lastRuntimeErrorSignatureRef.current = null;
    setRuntimeState(IDLE_RUNTIME_STATE);
  }, []);

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
