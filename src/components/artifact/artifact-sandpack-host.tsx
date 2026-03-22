'use client';

import { useMemo, type ReactNode } from 'react';
import { SandpackProvider } from '@codesandbox/sandpack-react';
import { ArtifactSandpackRuntimeBridge } from '@/components/artifact/artifact-sandpack-runtime-bridge';
import { ARTIFACT_SANDBOX_SETUP, ARTIFACT_TAILWIND_CDN_URL } from '@/lib/artifact-runtime';
import { DATASET_HELPER_PATH, REBOLT_OPENAI_PROXY_PATH } from '@/lib/tools/constants';
import { buildReboltOpenAIProxyRuntimeHelper } from '@/lib/tools/rebolt-openai-proxy-runtime-helper';
import { cn } from '@/lib/utils';
import type { ArtifactRuntimeMode, ArtifactRuntimeSurfaceProps } from '@/types/components';

interface ArtifactSandpackHostProps extends ArtifactRuntimeSurfaceProps {
  readonly children: ReactNode;
  readonly className?: string;
}

function buildEntryFile(runtimeMode: ArtifactRuntimeMode): string {
  return `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/App";

const runtimeWindow = globalThis as typeof globalThis & {
  __REBOLT_ARTIFACT_RUNTIME_MODE__?: "interactive" | "validation";
};

runtimeWindow.__REBOLT_ARTIFACT_RUNTIME_MODE__ = ${JSON.stringify(runtimeMode)};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`;
}

const HIDDEN_FILES = new Set(['/index.tsx', DATASET_HELPER_PATH, REBOLT_OPENAI_PROXY_PATH]);

export function ArtifactSandpackHost({
  artifactKey,
  files,
  runtimeMode,
  onRuntimeEvent,
  children,
  className,
}: ArtifactSandpackHostProps) {
  const runtimeOpenAIProxyHelper = useMemo(() => buildReboltOpenAIProxyRuntimeHelper(), []);
  const sandpackFiles = useMemo(() => {
    const result: Record<string, string | { code: string; hidden?: boolean }> = {};

    for (const [path, content] of Object.entries(files)) {
      if (path === REBOLT_OPENAI_PROXY_PATH) {
        result[path] = { code: runtimeOpenAIProxyHelper, hidden: true };
        continue;
      }

      result[path] = HIDDEN_FILES.has(path) ? { code: content, hidden: true } : content;
    }

    result['/index.tsx'] = { code: buildEntryFile(runtimeMode), hidden: true };
    return result;
  }, [files, runtimeMode, runtimeOpenAIProxyHelper]);

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
    <div className={cn('artifact-sandpack h-full min-w-0 w-full overflow-hidden', className)}>
      <SandpackProvider
        key={artifactKey}
        template="react-ts"
        files={sandpackFiles}
        customSetup={ARTIFACT_SANDBOX_SETUP}
        options={options}
      >
        <ArtifactSandpackRuntimeBridge onRuntimeEvent={onRuntimeEvent} runtimeMode={runtimeMode} />
        {children}
      </SandpackProvider>
    </div>
  );
}
