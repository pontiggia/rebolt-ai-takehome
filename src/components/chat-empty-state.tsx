'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

export function ChatEmptyState() {
  const [input, setInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSend = async () => {
    if (!input.trim() || isCreating) return;
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialMessage: input.trim() }),
      });

      const payload = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (!res.ok || !payload?.id) {
        throw new Error(payload?.message ?? 'Failed to create conversation');
      }

      startTransition(() => {
        router.push(`/chat/${payload.id}`);
        router.refresh();
      });
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'Failed to create conversation');
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">What do you need?</h1>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-2 rounded-xl border bg-background px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <input
            type="text"
            placeholder="Tell me what do you need"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled={isCreating}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isCreating}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
