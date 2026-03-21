'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { ArtifactRetryRequestPayload, RetryRequestResult } from '@/lib/artifact/artifact-retry';
import type { GenerateArtifactToolError } from '@/lib/artifact/artifact-message-selectors';

interface UseArtifactToolErrorRetryOptions {
  readonly latestToolError: GenerateArtifactToolError | null;
  readonly lastToolErrorSignatureRef: RefObject<string | null>;
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
