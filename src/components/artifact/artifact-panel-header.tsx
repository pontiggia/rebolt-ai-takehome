import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtifactPanelView } from '@/types/components';

interface ArtifactPanelHeaderProps {
  readonly title: string | null;
  readonly view: ArtifactPanelView;
  readonly onViewChange: (view: ArtifactPanelView) => void;
  readonly onClose: () => void;
}

interface ArtifactViewButtonProps {
  readonly label: string;
  readonly isActive: boolean;
  readonly onClick: () => void;
}

function ArtifactViewButton({ label, isActive, onClick }: ArtifactViewButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn('rounded px-2 py-1 text-xs', isActive ? 'bg-muted font-medium' : 'text-muted-foreground')}
    >
      {label}
    </button>
  );
}

export function ArtifactPanelHeader({ title, view, onViewChange, onClose }: ArtifactPanelHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
      <span className="truncate text-sm font-medium">{title ?? 'Artifact'}</span>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
          <ArtifactViewButton label="Preview" isActive={view === 'preview'} onClick={() => onViewChange('preview')} />
          <ArtifactViewButton label="</>" isActive={view === 'code'} onClick={() => onViewChange('code')} />
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close artifact panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
