import { useEffect, useEffectEvent } from 'react';
import { useSandpack } from '@codesandbox/sandpack-react';
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
}: Pick<ArtifactRuntimeSurfaceProps, 'onRuntimeEvent'>) {
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
