'use client';

import type { ReactNode } from 'react';
import { ChatInputToolbar } from '@/components/chat-input-toolbar';
import { AttachButton } from '@/components/chat-input-attach-button';
import { SubmitButton } from '@/components/chat-input-submit-button';
import { ChatInputTextArea } from '@/components/chat-input-textarea';

function ChatInputRoot({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <div
      className={`rounded-2xl border bg-background shadow-sm transition-shadow focus-within:shadow-md ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export const ChatInput = Object.assign(ChatInputRoot, {
  Toolbar: ChatInputToolbar,
  AttachButton,
  SubmitButton,
  TextArea: ChatInputTextArea,
});
