import type { ActiveArtifact, ArtifactRuntimeEvent, ArtifactRuntimeState } from '@/types/chat';

export interface ArtifactPanelProps {
  readonly artifact: ActiveArtifact;
  readonly runtimeState: ArtifactRuntimeState;
  readonly isRetryDisabled: boolean;
  readonly onManualRetry: () => void;
  readonly onRuntimeEvent: (event: ArtifactRuntimeEvent) => void;
  readonly onClose: () => void;
}

export interface FileUploadBadgeProps {
  readonly fileName: string;
  readonly rowCount: number;
}

export interface SidebarItemProps {
  readonly id: string;
  readonly title: string;
  readonly isActive: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
}
