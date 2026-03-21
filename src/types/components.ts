import type { ActiveArtifact, ArtifactRuntimeEvent, ArtifactRuntimeState } from '@/types/chat';

export type ArtifactPanelView = 'preview' | 'code';

export interface ArtifactPanelProps {
  readonly artifact: ActiveArtifact;
  readonly runtimeState: ArtifactRuntimeState;
  readonly isRetryDisabled: boolean;
  readonly onManualRetry: () => void;
  readonly onRuntimeEvent: (event: ArtifactRuntimeEvent) => void;
  readonly onClose: () => void;
}

export interface ArtifactSandpackProps {
  readonly artifactKey: string;
  readonly files: Readonly<Record<string, string>>;
  readonly view: ArtifactPanelView;
  readonly onRuntimeEvent: (event: ArtifactRuntimeEvent) => void;
}

export interface FileUploadBadgeProps {
  readonly fileName: string;
  readonly fileType: string;
}

export interface SidebarItemProps {
  readonly id: string;
  readonly title: string;
  readonly isActive: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
}
