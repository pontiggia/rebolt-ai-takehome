'use client';

import { useCallback, useState, useTransition } from 'react';
import { createArtifactArchive, triggerBlobDownload } from '@/lib/artifact/artifact-export';
import type { ActiveArtifact } from '@/types/chat';

type ArtifactDownloadStatus = 'idle' | 'preparing' | 'error';

function getDownloadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Failed to prepare the artifact download.';
}

export function useArtifactDownload(artifact: ActiveArtifact) {
  const [status, setStatus] = useState<ArtifactDownloadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDownload = useCallback(() => {
    if (isPending || status === 'preparing') {
      return;
    }

    setError(null);
    setStatus('preparing');

    startTransition(async () => {
      try {
        const { blob, fileName } = await createArtifactArchive(artifact);
        triggerBlobDownload(blob, fileName);
        setStatus('idle');
      } catch (nextError) {
        setError(getDownloadErrorMessage(nextError));
        setStatus('error');
      }
    });
  }, [artifact, isPending, status]);

  return {
    error,
    isPreparing: isPending || status === 'preparing',
    status,
    handleDownload,
  } as const;
}
