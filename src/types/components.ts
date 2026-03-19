export interface ArtifactPanelProps {
  readonly title: string | null;
  readonly code: string | null;
  readonly error: string | null;
  readonly retryCount: number;
  readonly onFixError: () => void;
}

export interface FileUploadBadgeProps {
  readonly fileName: string;
  readonly rowCount: number;
  readonly onRemove: () => void;
}

export interface SidebarItemProps {
  readonly id: string;
  readonly title: string;
  readonly isActive: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
}
