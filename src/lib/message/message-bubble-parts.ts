import { isAppToolInvocation } from '@/lib/agent-activity';
import type {
  AgentActivityDataChunk,
  AgentActivityDataPart,
  AppToolInvocation,
  AppUIMessage,
  GenerateArtifactToolInvocation,
} from '@/types/ai';

export type MessageBubblePart = AppUIMessage['parts'][number];

export function isTerminalToolPart(
  part: MessageBubblePart,
): part is Extract<AppToolInvocation, { state: 'output-available' | 'output-error' }> {
  return isAppToolInvocation(part) && (part.state === 'output-available' || part.state === 'output-error');
}

export function getVisibleMessageParts(parts: readonly MessageBubblePart[]): MessageBubblePart[] {
  const lastToolPartIndexByCallId = new Map<string, number>();
  const lastTerminalToolIndexByType = new Map<string, number>();

  parts.forEach((part, index) => {
    if (isAppToolInvocation(part)) {
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

    if (!isAppToolInvocation(part)) {
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

export function hasMoreSpecificProgressAfter(parts: readonly MessageBubblePart[], startIndex: number): boolean {
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

export function getArtifactCardParts(parts: readonly MessageBubblePart[]): GenerateArtifactToolInvocation[] {
  return parts.filter(
    (part): part is GenerateArtifactToolInvocation =>
      part.type === 'tool-generateArtifact' && part.state === 'output-available',
  );
}

export function getArtifactFallbackMessage(parts: readonly MessageBubblePart[]): string | null {
  const hasVisibleText = parts.some((part) => part.type === 'text' && part.text.trim().length > 0);
  if (hasVisibleText) {
    return null;
  }

  const latestArtifactPart = [...parts]
    .reverse()
    .find(
      (part): part is GenerateArtifactToolInvocation =>
        part.type === 'tool-generateArtifact' && part.state === 'output-available',
    );

  if (!latestArtifactPart) {
    return null;
  }

  const outputTitle = latestArtifactPart.output?.title?.trim() ?? '';
  const inputTitle = latestArtifactPart.input?.title?.trim() ?? '';
  const title = outputTitle || inputTitle;
  return title.length > 0 ? `I created ${title}.` : 'I created the artifact.';
}

export function getLiveActivityForPart(
  part: AgentActivityDataPart,
  liveActivitiesByToolCallId?: ReadonlyMap<string, AgentActivityDataChunk>,
): AgentActivityDataChunk | undefined {
  return part.data.kind === 'tool' && part.data.toolCallId
    ? liveActivitiesByToolCallId?.get(part.data.toolCallId)
    : undefined;
}
