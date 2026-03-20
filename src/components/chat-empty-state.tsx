'use client';

import { startTransition, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInput } from '@/components/chat-input';
import { ALLOWED_FILE_TYPES } from '@/types/file';

export function ChatEmptyState() {
  const [input, setInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    <div className="flex h-full flex-col items-center px-4 pt-[20vh]">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">What do you need?</h1>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <input ref={fileInputRef} type="file" accept={ALLOWED_FILE_TYPES.join(',')} className="hidden" />

        <ChatInput>
          <ChatInput.Toolbar
            left={<ChatInput.AttachButton onClick={() => fileInputRef.current?.click()} isUploading={false} />}
            right={
              <ChatInput.SubmitButton
                hasContent={!!input.trim()}
                disabled={!input.trim() || isCreating}
                onClick={() => void handleSend()}
              />
            }
          />
          <ChatInput.TextArea
            value={input}
            onChange={setInput}
            onSubmit={() => void handleSend()}
            disabled={isCreating}
          />
        </ChatInput>
      </div>
    </div>
  );
}
