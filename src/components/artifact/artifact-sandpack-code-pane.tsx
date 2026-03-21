import { SandpackCodeEditor, SandpackFileExplorer } from '@codesandbox/sandpack-react';
import type { ArtifactPanelView } from '@/types/components';

interface ArtifactSandpackCodePaneProps {
  readonly view: ArtifactPanelView;
}

export function ArtifactSandpackCodePane({ view }: ArtifactSandpackCodePaneProps) {
  return (
    <div style={{ display: view === 'code' ? 'flex' : 'none', height: '100%' }}>
      <SandpackFileExplorer autoHiddenFiles style={{ height: '100%', minWidth: 120, maxWidth: 160 }} />
      <SandpackCodeEditor showTabs={false} showLineNumbers readOnly style={{ height: '100%', flex: 1 }} />
    </div>
  );
}
