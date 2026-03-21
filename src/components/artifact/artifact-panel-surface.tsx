'use client';

import { ArtifactSandpackCodePane } from '@/components/artifact/artifact-sandpack-code-pane';
import { ArtifactSandpackHost } from '@/components/artifact/artifact-sandpack-host';
import { ArtifactSandpackPreviewPane } from '@/components/artifact/artifact-sandpack-preview-pane';
import type { ArtifactPanelView, ArtifactRuntimeSurfaceProps } from '@/types/components';

interface ArtifactPanelSurfaceProps extends ArtifactRuntimeSurfaceProps {
  readonly view: ArtifactPanelView;
}

export function ArtifactPanelSurface({ artifactKey, files, view, onRuntimeEvent }: ArtifactPanelSurfaceProps) {
  return (
    <ArtifactSandpackHost artifactKey={artifactKey} files={files} onRuntimeEvent={onRuntimeEvent}>
      <ArtifactSandpackPreviewPane view={view} />
      <ArtifactSandpackCodePane view={view} />
    </ArtifactSandpackHost>
  );
}
