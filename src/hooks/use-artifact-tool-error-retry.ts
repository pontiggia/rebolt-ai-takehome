'use client';

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type {
  GenerateArtifactToolError,
  ArtifactRetryRequestPayload,
  RetryRequestResult,
} from '@/hooks/use-artifact-helpers';

interface UseArtifactToolErrorRetryOptions {
  readonly latestToolError: GenerateArtifactToolError | null;
  readonly lastToolErrorSignatureRef: MutableRefObject<string | null>;
  readonly requestRetry: (payload: ArtifactRetryRequestPayload) => RetryRequestResult;
}

export function useArtifactToolErrorRetry({
  latestToolError,
  lastToolErrorSignatureRef,
  requestRetry,
}: UseArtifactToolErrorRetryOptions) {
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
  }, [lastToolErrorSignatureRef, latestToolError, requestRetry]);
}
