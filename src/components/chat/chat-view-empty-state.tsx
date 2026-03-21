import type { ReactNode } from 'react';

interface ChatViewEmptyStateProps {
  readonly creationError: string | null;
  readonly composer: ReactNode;
}

export function ChatViewEmptyState({ creationError, composer }: ChatViewEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center px-4 pt-[20vh]">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">What do you need?</h1>
        {creationError && <p className="text-sm text-destructive">{creationError}</p>}
        {composer}
      </div>
    </div>
  );
}
