'use client';

import { useMemo } from 'react';
import { SandpackProvider, SandpackPreview, SandpackCodeEditor } from '@codesandbox/sandpack-react';

interface ArtifactSandpackProps {
  readonly code: string;
  readonly view: 'preview' | 'code';
}

const ENTRY_FILE = `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`;

const CUSTOM_SETUP = {
  dependencies: {
    recharts: 'latest',
    react: '^18.2.0',
    'react-dom': '^18.2.0',
    'react-is': '^18.2.0',
  },
};

const OPTIONS = {
  visibleFiles: ['/App.tsx'] as string[],
};

export function ArtifactSandpack({ code, view }: ArtifactSandpackProps) {
  const files = useMemo(
    () => ({
      '/App.tsx': code,
      '/index.tsx': ENTRY_FILE,
    }),
    [code],
  );

  return (
    <div className="artifact-sandpack h-full">
      <SandpackProvider
        template="react-ts"
        files={files}
        customSetup={CUSTOM_SETUP}
        options={OPTIONS}
      >
        {view === 'preview' ? (
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={true}
            style={{ height: '100%' }}
          />
        ) : (
          <SandpackCodeEditor showTabs={false} showLineNumbers readOnly style={{ height: '100%' }} />
        )}
      </SandpackProvider>
    </div>
  );
}
