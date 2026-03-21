'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArtifactDownloadButton } from '@/components/artifact/artifact-download-button';
import { ArtifactPanelEmptyState } from '@/components/artifact/artifact-panel-empty-state';
import { ArtifactPanelHeader } from '@/components/artifact/artifact-panel-header';
import { ArtifactStatusFooter } from '@/components/artifact/artifact-status-footer';
import type { ArtifactPanelProps, ArtifactPanelView } from '@/types/components';

const ArtifactPanelSurface = dynamic(() => import('./artifact-panel-surface').then((m) => m.ArtifactPanelSurface), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted" />,
});

export function ArtifactPanel({
  artifact,
  runtimeState,
  isRetryDisabled,
  onManualRetry,
  onRuntimeEvent,
  onClose,
}: ArtifactPanelProps) {
  const [view, setView] = useState<ArtifactPanelView>('preview');

  if (!artifact.files || Object.keys(artifact.files).length === 0) {
    return <ArtifactPanelEmptyState />;
  }

  return (
    <div className="flex h-full w-full flex-col">
      <ArtifactPanelHeader
        title={artifact.title}
        view={view}
        onViewChange={setView}
        actions={<ArtifactDownloadButton key={artifact.key} artifact={artifact} />}
        onClose={onClose}
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        <ArtifactPanelSurface
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
