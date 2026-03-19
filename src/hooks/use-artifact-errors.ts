'use client';

import { useSandpack } from '@codesandbox/sandpack-react';
import { useState, useEffect } from 'react';

export function useArtifactErrors() {
  const { listen } = useSandpack();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = listen((msg) => {
      if (msg.type === 'action' && msg.action === 'show-error') {
        setError((msg as { message: string }).message);
      }
      if (msg.type === 'done') {
        setError(null);
      }
    });
    return unsubscribe;
  }, [listen]);

  return { error };
}
