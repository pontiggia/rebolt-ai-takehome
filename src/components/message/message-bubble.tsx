'use client';

import Image from 'next/image';
import { MarkdownRenderer } from '@/components/message/markdown-renderer';
import { FileUploadBadge } from '@/components/chat/file-upload-badge';
import { ToolInvocationPart } from '@/components/message/tool-invocation-part';
import type { FileMetadataResponse } from '@/types/api';
import type { UIMessage } from 'ai';

interface MessageBubbleProps {
  readonly message: UIMessage;
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly files?: readonly FileMetadataResponse[];
  readonly onArtifactClick?: () => void;
}

export function MessageBubble({ message, userInitials, userAvatarUrl, files, onArtifactClick }: MessageBubbleProps) {
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

  const artifactParts = message.parts.filter((part) => part.type === 'tool-generateArtifact');

  return (
    <div className="mt-2">
      <div>
          {message.parts.map((part, i) => {
            if (part.type === 'text') {
              return <MarkdownRenderer key={i} content={part.text} />;
            }
            if (part.type === 'tool-generateArtifact') {
              return <ToolInvocationPart key={i} toolName="generateArtifact" part={part} onArtifactClick={onArtifactClick} mode="instructions" />;
            }
            if (part.type.startsWith('tool-')) {
              const toolName = part.type.slice(5);
              return <ToolInvocationPart key={i} toolName={toolName} part={part} onArtifactClick={onArtifactClick} />;
            }
            return null;
          })}
          {artifactParts.map((part, i) => (
            <ToolInvocationPart key={`artifact-${i}`} toolName="generateArtifact" part={part} onArtifactClick={onArtifactClick} mode="card" />
          ))}
      </div>
    </div>
  );
}
