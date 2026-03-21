'use client';

import { SandpackPreview } from '@codesandbox/sandpack-react';
import { ArtifactSandpackHost } from '@/components/artifact/artifact-sandpack-host';
import type { ArtifactRuntimeSurfaceProps } from '@/types/components';

export function ArtifactBackgroundValidator({ artifactKey, files, onRuntimeEvent }: ArtifactRuntimeSurfaceProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 -left-[200vw] h-px w-px overflow-hidden opacity-0"
    >
      <ArtifactSandpackHost artifactKey={artifactKey} files={files} onRuntimeEvent={onRuntimeEvent}>
        <SandpackPreview
          showNavigator={false}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          showRestartButton={false}
          showSandpackErrorOverlay={false}
          style={{ width: 1, height: 1 }}
        />
      </ArtifactSandpackHost>
    </div>
  );
}
