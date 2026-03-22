import type { ActiveArtifact, ArtifactRuntimeEvent, ArtifactRuntimeState } from '@/types/chat';

export type ArtifactPanelView = 'preview' | 'code';
export type ArtifactRuntimeMode = 'interactive' | 'validation';

export interface ArtifactPanelProps {
  readonly artifact: ActiveArtifact;
  readonly runtimeState: ArtifactRuntimeState;
  readonly isRetryDisabled: boolean;
  readonly onManualRetry: () => void;
  readonly onRuntimeEvent: (event: ArtifactRuntimeEvent) => void;
  readonly onClose: () => void;
}

export interface ArtifactRuntimeSurfaceProps {
  readonly artifactKey: string;
  readonly files: Readonly<Record<string, string>>;
  readonly runtimeMode: ArtifactRuntimeMode;
  readonly onRuntimeEvent: (event: ArtifactRuntimeEvent) => void;
}

export interface FileUploadBadgeProps {
  readonly fileName: string;
  readonly fileType: string;
}
