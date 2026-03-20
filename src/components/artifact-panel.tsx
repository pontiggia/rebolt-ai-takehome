'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtifactPanelProps } from '@/types/components';
import { MAX_ARTIFACT_RETRIES } from '@/types/chat';

const ArtifactSandpack = dynamic(() => import('./artifact-sandpack').then((m) => m.ArtifactSandpack), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted" />,
});

type ArtifactView = 'preview' | 'code';

function EmptyArtifactState() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No artifact generated yet
    </div>
  );
}

export function ArtifactPanel({ title, code, error, retryCount, onFixError, onClose }: ArtifactPanelProps) {
  const [view, setView] = useState<ArtifactView>('preview');

  if (!code) return <EmptyArtifactState />;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <span className="truncate text-sm font-medium">{title ?? 'Artifact'}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
            <button
              onClick={() => setView('preview')}
              className={cn(
                'rounded px-2 py-1 text-xs',
                view === 'preview' ? 'bg-muted font-medium' : 'text-muted-foreground',
              )}
            >
              Preview
            </button>
            <button
              onClick={() => setView('code')}
              className={cn(
                'rounded px-2 py-1 text-xs',
                view === 'code' ? 'bg-muted font-medium' : 'text-muted-foreground',
              )}
            >
              {'</>'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close artifact panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ArtifactSandpack code={code} view={view} />
      </div>

      {error && retryCount < MAX_ARTIFACT_RETRIES && (
        <div className="border-t p-3">
          <p className="mb-2 text-sm text-destructive">{error}</p>
          <button
            onClick={onFixError}
            className="rounded-md bg-destructive/10 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/20"
          >
            Fix Error
          </button>
        </div>
      )}
      {error && retryCount >= MAX_ARTIFACT_RETRIES && (
        <p className="p-3 text-sm text-muted-foreground">Max retries reached. Please clarify your request.</p>
      )}
    </div>
  );
}
