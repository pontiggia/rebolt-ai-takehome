'use client';

import { useEffect, useRef, useState } from 'react';
import type { ActiveArtifact } from '@/types/chat';

interface UseArtifactActiveStateOptions {
  readonly latestSuccessfulArtifact: ActiveArtifact | null;
  readonly onArtifactReplace: () => void;
}

export function useArtifactActiveState({ latestSuccessfulArtifact, onArtifactReplace }: UseArtifactActiveStateOptions) {
  const [activeArtifact, setActiveArtifact] = useState<ActiveArtifact | null>(() => latestSuccessfulArtifact);
  const activeArtifactRef = useRef(activeArtifact);

  useEffect(() => {
    activeArtifactRef.current = activeArtifact;
  }, [activeArtifact]);

  useEffect(() => {
    if (!latestSuccessfulArtifact || activeArtifactRef.current?.key === latestSuccessfulArtifact.key) {
      return;
    }

    let cancelled = false;
    activeArtifactRef.current = latestSuccessfulArtifact;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      onArtifactReplace();
      setActiveArtifact(latestSuccessfulArtifact);
    });

    return () => {
      cancelled = true;
    };
  }, [latestSuccessfulArtifact, onArtifactReplace]);

  return {
    activeArtifact,
    activeArtifactRef,
  } as const;
}
