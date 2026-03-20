'use client';

import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { FileUploadBadge } from '@/components/file-upload-badge';
import { ToolInvocationPart } from '@/components/tool-invocation-part';
import type { FileMetadataResponse } from '@/types/api';
import type { UIMessage } from 'ai';

interface MessageBubbleProps {
  readonly message: UIMessage;
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly files?: readonly FileMetadataResponse[];
}

export function MessageBubble({ message, userInitials, userAvatarUrl, files }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasFiles = files && files.length > 0;

  if (isUser) {
    return (
      <div className="flex items-end justify-end gap-3">
        <div className="flex flex-col items-end gap-2">
          {hasFiles && (
            <div className="flex flex-wrap justify-end gap-2">
              {files.map((file) => (
                <FileUploadBadge key={file.id} fileName={file.fileName} rowCount={file.rowCount} />
              ))}
            </div>
          )}
          <div className="rounded-2xl bg-primary/10 px-4 py-3 text-sm leading-relaxed">
            {message.parts.map((part, i) => {
              if (part.type === 'text') {
                return <span key={i}>{part.text}</span>;
              }
              return null;
            })}
          </div>
        </div>
        {userAvatarUrl ? (
          <Image
            src={userAvatarUrl}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-full"
            style={{ width: 28, height: 28 }}
            unoptimized
          />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
            {userInitials}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="text-sm leading-relaxed">
        <div className="prose prose-sm max-w-none">
          {message.parts.map((part, i) => {
            if (part.type === 'text') {
              return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>;
            }

            if (part.type.startsWith('tool-')) {
              const toolName = part.type.slice(5);
              return <ToolInvocationPart key={i} toolName={toolName} part={part} />;
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
