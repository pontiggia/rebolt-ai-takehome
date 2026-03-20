'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtifactPanelProps } from '@/types/components';
import { MAX_ARTIFACT_AUTO_RETRIES } from '@/types/chat';

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

function ArtifactStatusFooter({
  runtimeState,
  isRetryDisabled,
  onManualRetry,
}: Pick<ArtifactPanelProps, 'runtimeState' | 'isRetryDisabled' | 'onManualRetry'>) {
  if (runtimeState.status === 'idle') {
    return null;
  }

  if (runtimeState.status === 'retrying') {
    return (
      <div className="border-t bg-muted/30 px-3 py-2">
        <p className="text-sm font-medium">
          Self-correcting (attempt {runtimeState.retryCount}/{MAX_ARTIFACT_AUTO_RETRIES})...
        </p>
        {runtimeState.lastError && <p className="mt-1 text-xs text-muted-foreground">{runtimeState.lastError}</p>}
      </div>
    );
  }

  if (!runtimeState.lastError) {
    return null;
  }

  return (
    <div className="border-t p-3">
      <p className="mb-2 text-sm text-destructive">{runtimeState.lastError}</p>
      {runtimeState.status === 'exhausted' && (
        <p className="mb-2 text-xs text-muted-foreground">
          Automatic retries are exhausted. You can try one more manual correction cycle.
        </p>
      )}
      <button
        onClick={onManualRetry}
        disabled={isRetryDisabled}
        className={cn(
          'rounded-md px-3 py-1.5 text-sm transition-colors',
          isRetryDisabled
            ? 'cursor-not-allowed bg-muted text-muted-foreground'
            : 'bg-destructive/10 text-destructive hover:bg-destructive/20',
        )}
      >
        Try again
      </button>
    </div>
  );
}

export function ArtifactPanel({
  artifact,
  runtimeState,
  isRetryDisabled,
  onManualRetry,
  onRuntimeEvent,
  onClose,
}: ArtifactPanelProps) {
  const [view, setView] = useState<ArtifactView>('preview');

  if (!artifact.files || Object.keys(artifact.files).length === 0) return <EmptyArtifactState />;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <span className="truncate text-sm font-medium">{artifact.title ?? 'Artifact'}</span>
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
        <ArtifactSandpack
          artifactKey={artifact.key}
          files={artifact.files}
          view={view}
          onRuntimeEvent={onRuntimeEvent}
        />
      </div>

      <ArtifactStatusFooter
        runtimeState={runtimeState}
        isRetryDisabled={isRetryDisabled}
        onManualRetry={onManualRetry}
      />
    </div>
  );
}
