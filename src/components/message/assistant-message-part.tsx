'use client';

import { AgentActivityItem } from '@/components/message/agent-activity-item';
import { MarkdownRenderer } from '@/components/message/markdown-renderer';
import { ReasoningPart } from '@/components/message/reasoning-part';
import {
  AnalyzeDataToolPart,
  GenerateArtifactToolInstructionsPart,
  GenerateArtifactToolCardPart,
  ReadDatasetRowsToolPart,
} from '@/components/message/tool-invocation-part';
import {
  getLiveActivityForPart,
  hasMoreSpecificProgressAfter,
  type MessageBubblePart,
} from '@/lib/message/message-bubble-parts';
import type { AgentActivityDataChunk } from '@/types/ai';

interface AssistantMessagePartProps {
  readonly part: MessageBubblePart;
  readonly index: number;
  readonly visibleParts: readonly MessageBubblePart[];
  readonly liveActivitiesByToolCallId?: ReadonlyMap<string, AgentActivityDataChunk>;
}

export function AssistantMessagePart({
  part,
  index,
  visibleParts,
  liveActivitiesByToolCallId,
}: AssistantMessagePartProps) {
  if (part.type === 'text') {
    return <MarkdownRenderer content={part.text} />;
  }

  if (part.type === 'reasoning') {
    return <ReasoningPart part={part} />;
  }

  if (part.type === 'data-agent-activity') {
    if (part.data.kind === 'step' && hasMoreSpecificProgressAfter(visibleParts, index)) {
      return null;
    }

    return <AgentActivityItem part={part} liveActivity={getLiveActivityForPart(part, liveActivitiesByToolCallId)} />;
  }

  if (part.type === 'tool-analyzeData') {
    return <AnalyzeDataToolPart part={part} />;
  }

  if (part.type === 'tool-readDatasetRows') {
    return <ReadDatasetRowsToolPart part={part} />;
  }

  if (part.type === 'tool-generateArtifact') {
    return <GenerateArtifactToolInstructionsPart part={part} />;
  }

  return null;
}

export { GenerateArtifactToolCardPart };
