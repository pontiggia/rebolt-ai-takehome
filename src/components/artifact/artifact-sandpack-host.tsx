'use client';

import { useMemo, type ReactNode } from 'react';
import { SandpackProvider } from '@codesandbox/sandpack-react';
import { ArtifactSandpackRuntimeBridge } from '@/components/artifact/artifact-sandpack-runtime-bridge';
import { ARTIFACT_SANDBOX_SETUP, ARTIFACT_TAILWIND_CDN_URL } from '@/lib/artifact-runtime';
import { cn } from '@/lib/utils';
import type { ArtifactRuntimeSurfaceProps } from '@/types/components';

interface ArtifactSandpackHostProps extends ArtifactRuntimeSurfaceProps {
  readonly children: ReactNode;
  readonly className?: string;
}

const ENTRY_FILE = `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`;

const HIDDEN_FILES = new Set(['/index.tsx', '/src/rebolt-dataset.ts']);

export function ArtifactSandpackHost({
  artifactKey,
  files,
  onRuntimeEvent,
  children,
  className,
}: ArtifactSandpackHostProps) {
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
      externalResources: [ARTIFACT_TAILWIND_CDN_URL],
      initMode: 'immediate' as const,
      autorun: true,
    }),
    [],
  );

  return (
    <div className={cn('artifact-sandpack h-full w-full', className)}>
      <SandpackProvider
        key={artifactKey}
        template="react-ts"
        files={sandpackFiles}
        customSetup={ARTIFACT_SANDBOX_SETUP}
        options={options}
      >
        <ArtifactSandpackRuntimeBridge onRuntimeEvent={onRuntimeEvent} />
        {children}
      </SandpackProvider>
    </div>
  );
}
