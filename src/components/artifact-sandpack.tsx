'use client';

import { SandpackProvider, SandpackPreview, SandpackCodeEditor } from '@codesandbox/sandpack-react';

interface ArtifactSandpackProps {
  readonly code: string;
  readonly view: 'preview' | 'code';
}

export function ArtifactSandpack({ code, view }: ArtifactSandpackProps) {
  const files = {
    '/App.tsx': code,
    '/index.tsx': `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
    `,
  };

  return (
    <SandpackProvider
      template="react-ts"
      files={files}
      customSetup={{
        dependencies: {
          recharts: 'latest',
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
      }}
      options={{
        visibleFiles: ['/App.tsx'],
      }}
    >
      {view === 'preview' ? (
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={true}
          style={{ height: '100%', minHeight: '500px' }}
        />
      ) : (
        <SandpackCodeEditor showTabs={false} showLineNumbers readOnly style={{ height: '100%', minHeight: '500px' }} />
      )}
    </SandpackProvider>
  );
}
