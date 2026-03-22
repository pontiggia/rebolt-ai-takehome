import { SandpackCodeEditor, SandpackFileExplorer } from '@codesandbox/sandpack-react';
import type { ArtifactPanelView } from '@/types/components';

interface ArtifactSandpackCodePaneProps {
  readonly view: ArtifactPanelView;
}

export function ArtifactSandpackCodePane({ view }: ArtifactSandpackCodePaneProps) {
  return (
    <div className="h-full min-w-0 w-full" style={{ display: view === 'code' ? 'flex' : 'none' }}>
      <SandpackFileExplorer autoHiddenFiles style={{ height: '100%', minWidth: 120, maxWidth: 160 }} />
      <SandpackCodeEditor showTabs={false} showLineNumbers readOnly style={{ minWidth: 0, height: '100%', flex: 1 }} />
    </div>
  );
}
