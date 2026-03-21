'use client';

import { useEffect, useRef } from 'react';

interface ChatInputTextAreaProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}

export function ChatInputTextArea({
  value,
  onChange,
  onSubmit,
  placeholder = 'Tell me what do you need',
  disabled,
}: ChatInputTextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      className="w-full resize-none bg-transparent px-4 pb-4 pt-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
      style={{ maxHeight: '200px' }}
    />
  );
}
