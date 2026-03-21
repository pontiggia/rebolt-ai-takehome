import type {
  AgentActivityData,
  AgentActivityDataChunk,
  AgentActivityDataPart,
  AnalyzeDataToolInput,
  AnalyzeDataToolInvocation,
  AppAIExecutionContext,
  AppToolInvocation,
  AppToolName,
  AppUIMessage,
  AppUIMessagePart,
  ArtifactToolInput,
  GenerateArtifactToolInvocation,
  ReadDatasetRowsToolInput,
  ReadDatasetRowsToolInvocation,
  ReadDatasetRowsToolOutput,
} from '@/types/ai';

export const AGENT_ACTIVITY_PART_TYPE = 'data-agent-activity';

function formatColumnSummary(columns: readonly string[], maxColumns = 3): string | null {
  if (columns.length === 0) {
    return null;
  }

  const visibleColumns = columns.slice(0, maxColumns).join(', ');
  const remainingColumns = columns.length - maxColumns;

  if (remainingColumns <= 0) {
    return visibleColumns;
  }

  return `${visibleColumns}, +${remainingColumns} more`;
}

export function getToolActivityId(toolCallId: string): string {
  return `tool-${toolCallId}`;
}

export function getToolInternalActivityId(toolCallId: string): string {
  return `tool-internal-${toolCallId}`;
}

export function getStepActivityId(stepNumber: number): string {
  return `step-${stepNumber}`;
}

export function isAgentActivityDataPart(part: AppUIMessagePart): part is AgentActivityDataPart {
  return part.type === AGENT_ACTIVITY_PART_TYPE;
}

export function isAnalyzeDataToolInvocation(part: AppUIMessagePart): part is AnalyzeDataToolInvocation {
  return part.type === 'tool-analyzeData';
}

export function isReadDatasetRowsToolInvocation(part: AppUIMessagePart): part is ReadDatasetRowsToolInvocation {
  return part.type === 'tool-readDatasetRows';
}

export function isGenerateArtifactToolInvocation(part: AppUIMessagePart): part is GenerateArtifactToolInvocation {
  return part.type === 'tool-generateArtifact';
}

export function isAppToolInvocation(part: AppUIMessagePart): part is AppToolInvocation {
  return (
    isAnalyzeDataToolInvocation(part) ||
    isReadDatasetRowsToolInvocation(part) ||
    isGenerateArtifactToolInvocation(part)
  );
}

export function isRunningToolInvocation(part: AppToolInvocation): boolean {
  return (
    part.state === 'input-streaming' ||
    part.state === 'input-available' ||
    part.state === 'approval-requested' ||
    part.state === 'approval-responded'
  );
}

export function getRunningToolCallIds(messages: readonly AppUIMessage[]): Set<string> {
  const runningToolCallIds = new Set<string>();
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');

  if (!lastAssistantMessage) {
    return runningToolCallIds;
  }

  for (const part of lastAssistantMessage.parts) {
    if (isAppToolInvocation(part) && isRunningToolInvocation(part)) {
      runningToolCallIds.add(part.toolCallId);
    }
  }

  return runningToolCallIds;
}

export function getToolLabel(toolName: AppToolName): string {
  switch (toolName) {
    case 'analyzeData':
      return 'Analyzing data';
    case 'readDatasetRows':
      return 'Inspecting full dataset';
    case 'generateArtifact':
      return 'Generating artifact';
  }
}

export function getStepLabel(stepNumber: number): string {
  return `Step ${stepNumber}`;
}

export function describeAnalyzeDataInput(input: AnalyzeDataToolInput): string {
  const task = input.task.trim();
  const columnSummary = formatColumnSummary(input.columns);
  return columnSummary ? `${task} • ${columnSummary}` : task;
}

export function describeReadDatasetRowsInput(input: ReadDatasetRowsToolInput): string {
  const startRow = input.offset + 1;
  const endRow = input.offset + input.limit;
  const columnSummary = formatColumnSummary(input.columns ?? []);

  return columnSummary ? `Rows ${startRow}-${endRow} • ${columnSummary}` : `Rows ${startRow}-${endRow}`;
}

export function describeReadDatasetRowsOutput(output: ReadDatasetRowsToolOutput): string {
  const startRow = output.count > 0 ? output.offset + 1 : output.offset;
  const endRow = output.offset + output.count;
  const countLabel = `Loaded ${output.count} row${output.count === 1 ? '' : 's'}`;
  const rangeLabel = output.count > 0 ? `${countLabel} (${startRow}-${endRow} of ${output.totalRows})` : countLabel;
  const columnSummary = formatColumnSummary(output.columns);
  const moreLabel = output.hasMore ? ' • more available' : '';

  return columnSummary ? `${rangeLabel} • ${columnSummary}${moreLabel}` : `${rangeLabel}${moreLabel}`;
}

export function describeGenerateArtifactInput(input: ArtifactToolInput): string {
  return input.title.trim() || 'Untitled artifact';
}

export function describeToolInput(toolName: AppToolName, input: unknown): string | undefined {
  switch (toolName) {
    case 'analyzeData':
      return describeAnalyzeDataInput(input as AnalyzeDataToolInput);
    case 'readDatasetRows':
      return describeReadDatasetRowsInput(input as ReadDatasetRowsToolInput);
    case 'generateArtifact':
      return describeGenerateArtifactInput(input as ArtifactToolInput);
  }
}

export function describeToolSuccess(toolName: AppToolName, output: unknown): string | undefined {
  switch (toolName) {
    case 'analyzeData':
      return 'Analysis complete';
    case 'readDatasetRows':
      return describeReadDatasetRowsOutput(output as ReadDatasetRowsToolOutput);
    case 'generateArtifact':
      return 'Artifact ready';
  }
}

export function createAgentActivityChunk(
  id: string,
  activity: AgentActivityData,
  options: { transient?: boolean } = {},
): AgentActivityDataChunk {
  return {
    type: AGENT_ACTIVITY_PART_TYPE,
    id,
    data: activity,
    ...(options.transient ? { transient: true } : {}),
  };
}

export function getActivityReporter(context: unknown) {
  const reportActivity = (context as AppAIExecutionContext | null)?.reportActivity;
  return typeof reportActivity === 'function' ? reportActivity : null;
}
