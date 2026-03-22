import { useEffect, useEffectEvent } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
import { REBOLT_OPENAI_PROXY_VALIDATION_ERROR_MARKER } from '@/lib/artifact/rebolt-openai-proxy-protocol';
import type { ArtifactRuntimeSurfaceProps } from '@/types/components';

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

export function ArtifactSandpackRuntimeBridge({
  onRuntimeEvent,
  runtimeMode,
}: Pick<ArtifactRuntimeSurfaceProps, 'onRuntimeEvent' | 'runtimeMode'>) {
  const { sandpack, listen } = useSandpack();
  const emitRuntimeEvent = useEffectEvent(onRuntimeEvent);

  const shouldIgnoreValidationError = useEffectEvent((message: string) => {
    if (runtimeMode !== 'validation' || !message.startsWith(REBOLT_OPENAI_PROXY_VALIDATION_ERROR_MARKER)) {
      return false;
    }

    emitRuntimeEvent({ type: 'ready' });
    return true;
  });

  useEffect(() => {
    const unsubscribe = listen((message) => {
      if ((message.type === 'done' && !message.compilatonError) || message.type === 'connected') {
        emitRuntimeEvent({ type: 'ready' });
        return;
      }

      if (message.type === 'action' && message.action === 'show-error') {
        const errorMessage = getSandpackErrorMessage(message, 'The artifact preview threw an error.');
        if (shouldIgnoreValidationError(errorMessage)) {
          return;
        }

        emitRuntimeEvent({
          type: 'runtime-error',
          message: errorMessage,
        });
        return;
      }

      if (message.type === 'action' && message.action === 'notification' && message.notificationType === 'error') {
        const errorMessage = getSandpackErrorMessage(message, 'Sandpack reported a preview error.');
        if (shouldIgnoreValidationError(errorMessage)) {
          return;
        }

        emitRuntimeEvent({
          type: 'notification-error',
          message: errorMessage,
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
