'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load this chat view. You can try the request again.
        </p>
      </div>
      <button
        onClick={() => unstable_retry()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
