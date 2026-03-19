'use client';

import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="space-y-4 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">Application error</h1>
            <p className="text-sm text-muted-foreground">
              Something unexpected happened while rendering the app shell.
            </p>
          </div>
          <button
            onClick={() => unstable_retry()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
