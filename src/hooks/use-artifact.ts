'use client';

import { useCallback, useState } from 'react';
import type { UIMessage } from 'ai';
import type { ArtifactToolOutput } from '@/types/ai';
import type { ArtifactState } from '@/types/chat';

export function useArtifact(messages: UIMessage[], sendMessage: (options: { text: string }) => void) {
  const [artifactState, setArtifactState] = useState<ArtifactState>({
    code: null,
    error: null,
    retryCount: 0,
  });

  let latestArtifact: ArtifactToolOutput | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts ?? []) {
      if (part.type === 'tool-generateArtifact' && part.state === 'output-available') {
        latestArtifact = part.output as ArtifactToolOutput;
        break;
      }
    }
    if (latestArtifact) break;
  }

  const handleFixError = useCallback(() => {
    if (!artifactState.error) return;
    setArtifactState((prev) => ({
      ...prev,
      retryCount: prev.retryCount + 1,
    }));
    sendMessage({
      text: `The artifact produced this error: ${artifactState.error}. Please fix the code.`,
    });
  }, [artifactState.error, sendMessage]);

  return { latestArtifact, artifactState, handleFixError } as const;
}
