'use client';

import Image from 'next/image';
import { FileUploadBadge } from '@/components/chat/file-upload-badge';
import type { FileMetadataResponse } from '@/types/api';
import type { AppUIMessage } from '@/types/ai';

interface UserMessageBubbleProps {
  readonly message: AppUIMessage;
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly files?: readonly FileMetadataResponse[];
}

export function UserMessageBubble({ message, userInitials, userAvatarUrl, files }: UserMessageBubbleProps) {
  const hasFiles = files && files.length > 0;

  return (
    <div className="!mt-10 flex items-start justify-end gap-3">
      <div className="flex flex-col items-end gap-2">
        {hasFiles ? (
          <div className="flex flex-wrap justify-end gap-2">
            {files.map((file) => (
              <FileUploadBadge key={file.id} fileName={file.fileName} rowCount={file.rowCount} />
            ))}
          </div>
        ) : null}
        <div className="rounded-2xl rounded-tr-sm bg-primary/[0.07] px-4 py-3 font-sans text-sm leading-relaxed text-[#1e3a5f]">
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return <span key={index}>{part.text}</span>;
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
