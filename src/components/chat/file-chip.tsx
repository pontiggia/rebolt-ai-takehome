import type { MouseEventHandler } from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileChipBaseProps {
  readonly fileName: string;
  readonly fileType: string;
  readonly className?: string;
}

interface ClickableFileChipProps extends FileChipBaseProps {
  readonly onClick: MouseEventHandler<HTMLButtonElement>;
}

function getFileTypeLabel({ fileName, fileType }: FileChipBaseProps): string {
  const extension = fileName.split('.').pop()?.trim();
  if (extension) {
    return extension.toUpperCase();
  }

  if (fileType === 'text/csv') {
    return 'CSV';
  }

  if (fileType.includes('sheet')) {
    return 'XLSX';
  }

  return 'FILE';
}

function FileChipContent({ fileName, fileType }: FileChipBaseProps) {
  return (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{fileName}</span>
        <span className="mt-1 inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground">
          {getFileTypeLabel({ fileName, fileType })}
        </span>
      </span>
    </>
  );
}

const fileChipClassName =
  'inline-flex min-w-0 items-center gap-2 rounded-xl border border-border/80 bg-background px-3 py-2 text-left shadow-sm';

export function StaticFileChip({ fileName, fileType, className }: FileChipBaseProps) {
  return (
    <div className={cn(fileChipClassName, className)}>
      <FileChipContent fileName={fileName} fileType={fileType} />
    </div>
  );
}

export function ClickableFileChip({ fileName, fileType, className, onClick }: ClickableFileChipProps) {
  return (
    <button
      type="button"
      className={cn(
        fileChipClassName,
        'transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
      onClick={onClick}
    >
      <FileChipContent fileName={fileName} fileType={fileType} />
    </button>
  );
}
