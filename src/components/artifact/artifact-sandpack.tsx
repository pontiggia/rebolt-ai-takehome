'use client';

import { useMemo } from 'react';
import { SandpackProvider } from '@codesandbox/sandpack-react';
import { ArtifactSandpackCodePane } from '@/components/artifact/artifact-sandpack-code-pane';
import { ArtifactSandpackPreviewPane } from '@/components/artifact/artifact-sandpack-preview-pane';
import { ArtifactSandpackRuntimeBridge } from '@/components/artifact/artifact-sandpack-runtime-bridge';
import { ARTIFACT_SANDBOX_SETUP } from '@/lib/artifact-runtime';
import type { ArtifactSandpackProps } from '@/types/components';

const ENTRY_FILE = `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`;

const HIDDEN_FILES = new Set(['/index.tsx', '/src/rebolt-dataset.ts']);

export function ArtifactSandpack({ artifactKey, files, view, onRuntimeEvent }: ArtifactSandpackProps) {
  const sandpackFiles = useMemo(() => {
    const result: Record<string, string | { code: string; hidden?: boolean }> = {};
    for (const [path, content] of Object.entries(files)) {
      result[path] = HIDDEN_FILES.has(path) ? { code: content, hidden: true } : content;
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
      <SandpackProvider
        key={artifactKey}
        template="react-ts"
        files={sandpackFiles}
        customSetup={ARTIFACT_SANDBOX_SETUP}
        options={options}
      >
        <ArtifactSandpackRuntimeBridge onRuntimeEvent={onRuntimeEvent} />
        <ArtifactSandpackPreviewPane view={view} />
        <ArtifactSandpackCodePane view={view} />
      </SandpackProvider>
    </div>
  );
}
