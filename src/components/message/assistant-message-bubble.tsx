'use client';

import { ArtifactFallbackMessage } from '@/components/message/artifact-fallback-message';
import { AssistantMessagePart, GenerateArtifactToolCardPart } from '@/components/message/assistant-message-part';
import { getArtifactKey } from '@/lib/artifact/artifact-message-selectors';
import {
  getArtifactCardParts,
  getArtifactFallbackMessage,
  getVisibleMessageParts,
} from '@/lib/message/message-bubble-parts';
import type { AgentActivityDataChunk, AppUIMessage } from '@/types/ai';

interface AssistantMessageBubbleProps {
  readonly message: AppUIMessage;
  readonly activeArtifactKey?: string | null;
  readonly activeArtifactStatusLabel?: string | null;
  readonly onArtifactClick?: () => void;
  readonly liveActivitiesByToolCallId?: ReadonlyMap<string, AgentActivityDataChunk>;
}

export function AssistantMessageBubble({
  message,
  activeArtifactKey,
  activeArtifactStatusLabel,
  onArtifactClick,
  liveActivitiesByToolCallId,
}: AssistantMessageBubbleProps) {
  const visibleParts = getVisibleMessageParts(message.parts);
  const artifactParts = getArtifactCardParts(visibleParts);
  const artifactFallbackMessage = getArtifactFallbackMessage(visibleParts);

  return (
    <div className="mt-2">
      <div>
        {visibleParts.map((part, index) => (
          <AssistantMessagePart
            key={part.type === 'data-agent-activity' ? (part.id ?? `${part.type}-${index}`) : `${part.type}-${index}`}
            part={part}
            index={index}
            visibleParts={visibleParts}
            liveActivitiesByToolCallId={liveActivitiesByToolCallId}
          />
        ))}
        {artifactFallbackMessage ? <ArtifactFallbackMessage message={artifactFallbackMessage} /> : null}
        {artifactParts.map((part, index) => (
          <GenerateArtifactToolCardPart
            key={`artifact-${part.toolCallId ?? index}`}
            part={part}
            statusLabel={
              getArtifactKey(message.id, part.toolCallId) === activeArtifactKey
                ? (activeArtifactStatusLabel ?? undefined)
                : undefined
            }
            onArtifactClick={onArtifactClick}
          />
        ))}
      </div>
    </div>
  );
}
