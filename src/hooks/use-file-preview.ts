'use client';

import { useCallback, useRef, useState } from 'react';
import { fetchFilePreview } from '@/lib/api-client';
import type { FilePreviewResponse } from '@/types/api';

interface UseFilePreviewResult {
  readonly preview: FilePreviewResponse | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly loadPreview: (fileId: string) => Promise<void>;
  readonly resetPreview: () => void;
}

export function useFilePreview(): UseFilePreviewResult {
  const previewCacheRef = useRef<Map<string, FilePreviewResponse>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<FilePreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async (fileId: string) => {
    abortControllerRef.current?.abort();
    const cachedPreview = previewCacheRef.current.get(fileId);
    if (cachedPreview) {
      setPreview(cachedPreview);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPreview(null);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchFilePreview(fileId, controller.signal);
      previewCacheRef.current.set(fileId, response);

      if (abortControllerRef.current === controller) {
        setPreview(response);
        setIsLoading(false);
      }
    } catch (fetchError) {
      if (controller.signal.aborted) {
        return;
      }

      if (abortControllerRef.current === controller) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load file preview');
        setIsLoading(false);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  const resetPreview = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setPreview(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    preview,
    isLoading,
    error,
    loadPreview,
    resetPreview,
  };
}
