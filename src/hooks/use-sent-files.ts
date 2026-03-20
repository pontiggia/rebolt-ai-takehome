'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileMetadataResponse } from '@/types/api';

export function useSentFiles(messagesLength: number) {
  const [sentFilesMap, setSentFilesMap] = useState<Map<number, readonly FileMetadataResponse[]>>(new Map());
  const pendingRef = useRef<{ index: number; files: readonly FileMetadataResponse[] } | null>(null);

  const trackFiles = useCallback((index: number, files: readonly FileMetadataResponse[]) => {
    pendingRef.current = { index, files };
  }, []);

  useEffect(() => {
    if (pendingRef.current !== null && messagesLength > pendingRef.current.index) {
      const { index, files } = pendingRef.current;
      pendingRef.current = null;
      setSentFilesMap((prev) => new Map(prev).set(index, files));
    }
  }, [messagesLength]);

  return { sentFilesMap, trackFiles } as const;
}
