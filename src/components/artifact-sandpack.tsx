'use client';

import { useMemo } from 'react';
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackFileExplorer,
} from '@codesandbox/sandpack-react';

interface ArtifactSandpackProps {
  readonly files: Readonly<Record<string, string>>;
  readonly view: 'preview' | 'code';
}

const ENTRY_FILE = `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`;

const CUSTOM_SETUP = {
  dependencies: {
    recharts: 'latest',
    'lucide-react': 'latest',
    react: '^18.2.0',
    'react-dom': '^18.2.0',
    'react-is': '^18.2.0',
  },
};

export function ArtifactSandpack({ files, view }: ArtifactSandpackProps) {
  const sandpackFiles = useMemo(() => {
    const result: Record<string, string | { code: string; hidden?: boolean }> = {};
    for (const [path, content] of Object.entries(files)) {
      result[path] = content;
    }
    result['/index.tsx'] = { code: ENTRY_FILE, hidden: true };
    return result;
  }, [files]);

  const options = useMemo(
    () => ({
      activeFile: '/src/App.tsx' as string,
      externalResources: ['https://cdn.tailwindcss.com'],
    }),
    [],
  );

  return (
    <div className="artifact-sandpack h-full">
      <SandpackProvider template="react-ts" files={sandpackFiles} customSetup={CUSTOM_SETUP} options={options}>
        <div style={{ display: view === 'preview' ? 'block' : 'none', height: '100%' }}>
          <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton={true} style={{ height: '100%' }} />
        </div>
        <div style={{ display: view === 'code' ? 'flex' : 'none', height: '100%' }}>
          <SandpackFileExplorer autoHiddenFiles style={{ height: '100%', minWidth: 180, maxWidth: 220 }} />
          <SandpackCodeEditor showTabs={false} showLineNumbers readOnly style={{ height: '100%', flex: 1 }} />
        </div>
      </SandpackProvider>
    </div>
  );
}
