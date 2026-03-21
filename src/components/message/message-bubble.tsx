'use client';

import Image from 'next/image';
import { MarkdownRenderer } from '@/components/message/markdown-renderer';
import { FileUploadBadge } from '@/components/chat/file-upload-badge';
import { AgentActivityItem } from '@/components/message/agent-activity-item';
import { ReasoningPart } from '@/components/message/reasoning-part';
import {
  AnalyzeDataToolPart,
  GenerateArtifactToolPart,
  ReadDatasetRowsToolPart,
} from '@/components/message/tool-invocation-part';
import { isAppToolInvocation } from '@/lib/agent-activity';
import type { FileMetadataResponse } from '@/types/api';
import type {
  AgentActivityDataChunk,
  AppToolInvocation,
  AppUIMessage,
  GenerateArtifactToolInvocation,
} from '@/types/ai';

interface MessageBubbleProps {
  readonly message: AppUIMessage;
  readonly userInitials: string;
  readonly userAvatarUrl: string | null;
  readonly files?: readonly FileMetadataResponse[];
  readonly onArtifactClick?: () => void;
  readonly liveActivitiesByToolCallId?: ReadonlyMap<string, AgentActivityDataChunk>;
}

function hasToolCallId(part: AppUIMessage['parts'][number]): part is AppToolInvocation {
  return isAppToolInvocation(part);
}

function isTerminalToolPart(
  part: AppUIMessage['parts'][number],
): part is Extract<AppToolInvocation, { state: 'output-available' | 'output-error' }> {
  return isAppToolInvocation(part) && (part.state === 'output-available' || part.state === 'output-error');
}

function getVisibleMessageParts(parts: readonly AppUIMessage['parts'][number][]) {
  const lastToolPartIndexByCallId = new Map<string, number>();
  const lastTerminalToolIndexByType = new Map<string, number>();

  parts.forEach((part, index) => {
    if (hasToolCallId(part)) {
      lastToolPartIndexByCallId.set(part.toolCallId, index);

      if (isTerminalToolPart(part)) {
        lastTerminalToolIndexByType.set(part.type, index);
      }
    }
  });

  return parts.filter((part, index) => {
    if (part.type === 'step-start') {
      return false;
    }

    if (!hasToolCallId(part)) {
      return true;
    }

    if (lastToolPartIndexByCallId.get(part.toolCallId) !== index) {
      return false;
    }

    if (isTerminalToolPart(part)) {
      return lastTerminalToolIndexByType.get(part.type) === index;
    }

    return true;
  });
}

function hasMoreSpecificProgressAfter(parts: readonly AppUIMessage['parts'][number][], startIndex: number): boolean {
  return parts.slice(startIndex + 1).some((part) => {
    if (part.type === 'text') {
      return part.text.trim().length > 0;
    }

    if (part.type === 'reasoning') {
      return part.text.trim().length > 0;
    }

    if (part.type === 'data-agent-activity') {
      return part.data.kind === 'tool' && part.data.status === 'running';
    }

    return isTerminalToolPart(part);
  });
}

export function MessageBubble({
  message,
  userInitials,
  userAvatarUrl,
  files,
  onArtifactClick,
  liveActivitiesByToolCallId,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasFiles = files && files.length > 0;

  if (isUser) {
    return (
      <div className="!mt-10 flex items-start justify-end gap-3">
        <div className="flex flex-col items-end gap-2">
          {hasFiles && (
            <div className="flex flex-wrap justify-end gap-2">
              {files.map((file) => (
                <FileUploadBadge key={file.id} fileName={file.fileName} rowCount={file.rowCount} />
              ))}
            </div>
          )}
          <div className="rounded-2xl rounded-tr-sm bg-primary/[0.07] px-4 py-3 font-sans text-sm leading-relaxed text-[#1e3a5f]">
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

  const visibleParts = getVisibleMessageParts(message.parts);
  const artifactParts = visibleParts.filter(
    (part): part is GenerateArtifactToolInvocation =>
      part.type === 'tool-generateArtifact' && part.state === 'output-available',
  );

  return (
    <div className="mt-2">
      <div>
        {visibleParts.map((part, i) => {
          if (part.type === 'text') {
            return <MarkdownRenderer key={i} content={part.text} />;
          }

          if (part.type === 'reasoning') {
            return <ReasoningPart key={i} part={part} />;
          }

          if (part.type === 'data-agent-activity') {
            if (part.data.kind === 'step' && hasMoreSpecificProgressAfter(visibleParts, i)) {
              return null;
            }

            const liveActivity =
              part.data.kind === 'tool' && part.data.toolCallId
                ? liveActivitiesByToolCallId?.get(part.data.toolCallId)
                : undefined;

            return <AgentActivityItem key={part.id ?? `${part.type}-${i}`} part={part} liveActivity={liveActivity} />;
          }

          if (part.type === 'tool-analyzeData') {
            return <AnalyzeDataToolPart key={part.toolCallId} part={part} />;
          }

          if (part.type === 'tool-readDatasetRows') {
            return <ReadDatasetRowsToolPart key={part.toolCallId} part={part} />;
          }

          if (part.type === 'tool-generateArtifact') {
            return (
              <GenerateArtifactToolPart
                key={`${part.toolCallId}-instructions`}
                part={part}
                onArtifactClick={onArtifactClick}
                mode="instructions"
              />
            );
          }

          return null;
        })}
        {artifactParts.map((part, i) => (
          <GenerateArtifactToolPart
            key={`artifact-${part.toolCallId ?? i}`}
            part={part}
            onArtifactClick={onArtifactClick}
            mode="card"
          />
        ))}
      </div>
    </div>
  );
}
