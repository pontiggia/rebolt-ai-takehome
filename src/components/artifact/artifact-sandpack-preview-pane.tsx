import { SandpackPreview } from '@codesandbox/sandpack-react';
import type { ArtifactPanelView } from '@/types/components';

interface ArtifactSandpackPreviewPaneProps {
  readonly view: ArtifactPanelView;
}

export function ArtifactSandpackPreviewPane({ view }: ArtifactSandpackPreviewPaneProps) {
  return (
    <div
      className="h-full min-w-0 w-full overflow-hidden"
      style={{ display: view === 'preview' ? 'block' : 'none' }}
    >
      <SandpackPreview
        showOpenInCodeSandbox={false}
        showRefreshButton={true}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
