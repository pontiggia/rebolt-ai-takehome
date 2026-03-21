import 'server-only';

import {
  createAgentActivityChunk,
  describeToolInput,
  describeToolSuccess,
  getStepLabel,
  getToolLabel,
} from '@/lib/agent-activity';
import type { AgentActivityData, AgentActivityReporter, AppToolName } from '@/types/ai';

export function getChatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to generate the chat response.';
}

export function createStepStartActivity(stepNumber: number, previousStepCount: number): AgentActivityData {
  return {
    kind: 'step',
    status: 'running',
    label: previousStepCount === 0 ? 'Thinking' : 'Planning the next move',
    stepNumber,
  };
}

function summarizeStepCompletion(
  stepText: string,
  reasoningText: string | undefined,
  toolNames: readonly AppToolName[],
): string {
  if (toolNames.length === 1) {
    return `Used ${getToolLabel(toolNames[0]).toLowerCase()}`;
  }

  if (toolNames.length > 1) {
    return `Used ${toolNames.length} tools`;
  }

  if (stepText.trim().length > 0) {
    return 'Drafted response for the user';
  }

  if (reasoningText?.trim().length) {
    return 'Completed reasoning';
  }

  return 'Step completed';
}

export function createStepFinishActivity(
  stepNumber: number,
  stepText: string,
  reasoningText: string | undefined,
  toolNames: readonly AppToolName[],
): AgentActivityData {
  return {
    kind: 'step',
    status: 'completed',
    label: getStepLabel(stepNumber),
    detail: summarizeStepCompletion(stepText, reasoningText, toolNames),
    stepNumber,
  };
}

export function createToolStartActivity(toolName: AppToolName, toolCallId: string, input: unknown): AgentActivityData {
  return {
    kind: 'tool',
    status: 'running',
    label: getToolLabel(toolName),
    detail: describeToolInput(toolName, input),
    toolName,
    toolCallId,
  };
}

export function createToolFinishActivity(
  toolName: AppToolName,
  toolCallId: string,
  result: { success: true; output: unknown } | { success: false; error: unknown },
): AgentActivityData {
  return {
    kind: 'tool',
    status: result.success ? 'completed' : 'error',
    label: getToolLabel(toolName),
    detail: result.success ? describeToolSuccess(toolName, result.output) : getChatErrorMessage(result.error),
    toolName,
    toolCallId,
  };
}

export function createActivityReporter(
  write: (event: ReturnType<typeof createAgentActivityChunk>) => void,
): AgentActivityReporter {
  return ({ id, activity, transient }) => {
    write(createAgentActivityChunk(id, activity, { transient }));
  };
}
