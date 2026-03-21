import type { RefObject } from 'react';
import { ArtifactPanel } from '@/components/artifact/artifact-panel';
import { ResizeHandle } from '@/components/artifact/resize-handle';
import type { ActiveArtifact, ArtifactRuntimeEvent, ArtifactRuntimeState } from '@/types/chat';

interface ChatViewArtifactPaneProps {
  readonly artifact: ActiveArtifact | null;
  readonly isOpen: boolean;
  readonly panelWidth: number;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly runtimeState: ArtifactRuntimeState;
  readonly isRetryDisabled: boolean;
  readonly onManualRetry: () => void;
  readonly onRuntimeEvent: (event: ArtifactRuntimeEvent) => void;
  readonly onClose: () => void;
  readonly onResizeStart: (event: React.PointerEvent) => void;
  readonly onResizeMove: (event: React.PointerEvent) => void;
  readonly onResizeEnd: () => void;
}

export function ChatViewArtifactPane({
  artifact,
  isOpen,
  panelWidth,
  containerRef,
  runtimeState,
  isRetryDisabled,
  onManualRetry,
  onRuntimeEvent,
  onClose,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: ChatViewArtifactPaneProps) {
  if (!artifact || !isOpen) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative flex h-full flex-col border-l" style={{ width: panelWidth }}>
      <ResizeHandle onResizeStart={onResizeStart} onResizeMove={onResizeMove} onResizeEnd={onResizeEnd} />
      <ArtifactPanel
        artifact={artifact}
        runtimeState={runtimeState}
        isRetryDisabled={isRetryDisabled}
        onManualRetry={onManualRetry}
        onRuntimeEvent={onRuntimeEvent}
        onClose={onClose}
      />
    </div>
  );
}
