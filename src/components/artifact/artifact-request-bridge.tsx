'use client';

import { useEffect, useEffectEvent } from 'react';
import { relayArtifactAIRequest } from '@/lib/artifact/rebolt-ai-bridge';
import { relayArtifactOpenAIProxyRequest } from '@/lib/artifact/rebolt-openai-proxy-bridge';
import type { ActiveArtifact } from '@/types/chat';

interface ArtifactRequestBridgeProps {
  readonly conversationId: string | null;
  readonly artifact: ActiveArtifact | null;
}

export function ArtifactRequestBridge({ conversationId, artifact }: ArtifactRequestBridgeProps) {
  const handleArtifactRequest = useEffectEvent(async (event: MessageEvent<unknown>) => {
    const handledOpenAIProxy = await relayArtifactOpenAIProxyRequest({
      data: event.data,
      origin: event.origin,
      source: event.source,
      conversationId,
      artifact,
    });

    if (handledOpenAIProxy) {
      return;
    }

    await relayArtifactAIRequest({
      data: event.data,
      origin: event.origin,
      source: event.source,
      conversationId,
      artifact,
    });
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      void handleArtifactRequest(event);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return null;
}
