'use client';

import { AgentActivityLine } from '@/components/message/agent-activity-line';
import { useDisclosure } from '@/hooks/use-disclosure';
import { getAgentActivityStatusClasses } from '@/lib/message/agent-activity-styles';
import type { AgentActivityDataChunk, AgentActivityDataPart } from '@/types/ai';

export function AgentActivityItem({
  part,
  liveActivity,
}: {
  readonly part: AgentActivityDataPart;
  readonly liveActivity?: AgentActivityDataChunk;
}) {
  const { expanded, toggle } = useDisclosure();

  if (part.data.status !== 'running' || (part.data.kind !== 'tool' && part.data.kind !== 'step')) {
    return null;
  }

  const runningLiveActivity = liveActivity?.data.status === 'running' ? liveActivity : undefined;
  const hasDetails = Boolean(part.data.detail || runningLiveActivity);
  const statusClasses = getAgentActivityStatusClasses(part.data.status);
  const label = part.data.label;

  return (
    <div className="my-2">
      {hasDetails ? (
        <button type="button" onClick={toggle} className="flex items-center gap-2 text-left" aria-expanded={expanded}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${statusClasses.dot}`} />
          <span className={`text-sm font-medium ${statusClasses.label}`}>{label}</span>
          <span className="text-xs text-muted-foreground/70">{expanded ? '▾' : '▸'}</span>
        </button>
      ) : (
        <AgentActivityLine label={label} status={part.data.status} />
      )}
      {hasDetails && expanded ? (
        <div className="mt-1 space-y-1 pl-4">
          {part.data.detail ? <p className="text-xs text-muted-foreground">{part.data.detail}</p> : null}
          {runningLiveActivity ? (
            <AgentActivityLine
              label={runningLiveActivity.data.label}
              detail={runningLiveActivity.data.detail}
              status={runningLiveActivity.data.status}
              size="detail"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
