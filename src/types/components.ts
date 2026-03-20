export interface ArtifactPanelProps {
  readonly title: string | null;
  readonly files: Readonly<Record<string, string>> | null;
  readonly error: string | null;
  readonly retryCount: number;
  readonly onFixError: () => void;
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
