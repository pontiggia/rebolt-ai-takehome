import type { ReactNode } from 'react';
import { Code, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtifactPanelView } from '@/types/components';

interface ArtifactPanelHeaderProps {
  readonly title: string | null;
  readonly view: ArtifactPanelView;
  readonly onViewChange: (view: ArtifactPanelView) => void;
  readonly actions?: ReactNode;
  readonly onClose: () => void;
}

const VIEW_OPTIONS = [
  { value: 'preview' as const, icon: Eye, label: 'Preview' },
  { value: 'code' as const, icon: Code, label: 'Code' },
];

export function ArtifactPanelHeader({ title, view, onViewChange, actions, onClose }: ArtifactPanelHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{title ?? 'Artifact'}</span>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <div className="flex items-center gap-0.5 rounded-full border bg-muted p-0.5">
          {VIEW_OPTIONS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => onViewChange(value)}
              className={cn(
                'rounded-full p-1.5 transition-all duration-200',
                view === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={label}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close artifact panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
