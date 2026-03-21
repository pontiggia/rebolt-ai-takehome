'use client';

import { useCallback, useRef } from 'react';
import type { ChatOnFinishCallback } from 'ai';
import type { AppUIMessage } from '@/types/ai';

type ChatFinishEvent = Parameters<ChatOnFinishCallback<AppUIMessage>>[0];

interface ArtifactRequestRelayCallbacks {
  readonly onError?: (error: Error) => void;
  readonly onFinish?: (event: ChatFinishEvent) => void;
}

export function useArtifactRequestRelay() {
  const callbacksRef = useRef<ArtifactRequestRelayCallbacks>({});

  const relayError = useCallback((error: Error) => {
    callbacksRef.current.onError?.(error);
  }, []);

  const relayFinish = useCallback((event: ChatFinishEvent) => {
    callbacksRef.current.onFinish?.(event);
  }, []);

  const setCallbacks = useCallback((callbacks: ArtifactRequestRelayCallbacks) => {
    callbacksRef.current = callbacks;
  }, []);

  return {
    relayError,
    relayFinish,
    setCallbacks,
  } as const;
}
