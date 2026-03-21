'use client';

import { useEffect, useEffectEvent, useMemo } from 'react';
import {
  SandpackProvider,
  SandpackPreview,
  SandpackCodeEditor,
  SandpackFileExplorer,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { ARTIFACT_SANDBOX_SETUP } from '@/lib/artifact-runtime';
import type { ArtifactRuntimeEvent } from '@/types/chat';

interface ArtifactSandpackProps {
  readonly artifactKey: string;
  readonly files: Readonly<Record<string, string>>;
  readonly view: 'preview' | 'code';
  readonly onRuntimeEvent: (event: ArtifactRuntimeEvent) => void;
}

const ENTRY_FILE = `
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`;

const HIDDEN_FILES = new Set(['/index.tsx', '/src/rebolt-dataset.ts']);

function getSandpackErrorMessage(
  message: Partial<Record<'message' | 'title' | 'description', unknown>>,
  fallback: string,
): string {
  const candidates = [message.message, message.title, message.description];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return fallback;
}

function SandpackRuntimeBridge({ onRuntimeEvent }: Pick<ArtifactSandpackProps, 'onRuntimeEvent'>) {
  const { sandpack, listen } = useSandpack();
  const emitRuntimeEvent = useEffectEvent(onRuntimeEvent);

  useEffect(() => {
    const unsubscribe = listen((message) => {
      if ((message.type === 'done' && !message.compilatonError) || message.type === 'connected') {
        emitRuntimeEvent({ type: 'ready' });
        return;
      }

      if (message.type === 'action' && message.action === 'show-error') {
        emitRuntimeEvent({
          type: 'runtime-error',
          message: getSandpackErrorMessage(message, 'The artifact preview threw an error.'),
        });
        return;
      }

      if (message.type === 'action' && message.action === 'notification' && message.notificationType === 'error') {
        emitRuntimeEvent({
          type: 'notification-error',
          message: getSandpackErrorMessage(message, 'Sandpack reported a preview error.'),
        });
      }
    });

    return unsubscribe;
  }, [listen]);

  useEffect(() => {
    if (sandpack.status === 'timeout') {
      emitRuntimeEvent({
        type: 'timeout',
        message: 'The artifact preview timed out before it finished compiling or rendering.',
      });
    }
  }, [sandpack.status]);

  return null;
}

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
        <SandpackRuntimeBridge onRuntimeEvent={onRuntimeEvent} />
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
