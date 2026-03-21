import { SandpackPreview } from '@codesandbox/sandpack-react';
import type { ArtifactPanelView } from '@/types/components';

interface ArtifactSandpackPreviewPaneProps {
  readonly view: ArtifactPanelView;
}

export function ArtifactSandpackPreviewPane({ view }: ArtifactSandpackPreviewPaneProps) {
  return (
    <div style={{ display: view === 'preview' ? 'block' : 'none', height: '100%' }}>
      <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton={true} style={{ height: '100%' }} />
    </div>
  );
}
