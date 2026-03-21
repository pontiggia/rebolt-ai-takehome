'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { ChatInputToolbar } from '@/components/chat/chat-input-toolbar';
import { AttachButton } from '@/components/chat/chat-input-attach-button';
import { SubmitButton } from '@/components/chat/chat-input-submit-button';
import { ChatInputTextArea } from '@/components/chat/chat-input-textarea';

type ChatInputRootProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  readonly children: ReactNode;
};

function ChatInputRoot({ children, className, ...props }: ChatInputRootProps) {
  return (
    <div
      className={`rounded-2xl border bg-background shadow-sm transition-shadow focus-within:shadow-md ${className ?? ''}`}
      {...props}
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
