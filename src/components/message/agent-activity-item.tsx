'use client';

import { useState } from 'react';
import type { AgentActivityDataChunk, AgentActivityDataPart } from '@/types/ai';

function getStatusClasses(status: AgentActivityDataPart['data']['status'] | AgentActivityDataChunk['data']['status']) {
  switch (status) {
    case 'error':
      return {
        dot: 'bg-destructive',
        label: 'text-destructive',
        detail: 'text-destructive/80',
      };
    case 'completed':
      return {
        dot: 'bg-foreground/55',
        label: 'text-foreground/80',
        detail: 'text-muted-foreground',
      };
    case 'running':
      return {
        dot: 'animate-pulse bg-foreground/65',
        label: 'text-foreground/85',
        detail: 'text-muted-foreground',
      };
  }
}

function ActivityLine({
  label,
  detail,
  status,
  size = 'base',
}: {
  readonly label: string;
  readonly detail?: string;
  readonly status: AgentActivityDataPart['data']['status'] | AgentActivityDataChunk['data']['status'];
  readonly size?: 'base' | 'detail';
}) {
  const statusClasses = getStatusClasses(status);

  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-1.5 shrink-0 rounded-full ${size === 'base' ? 'h-2 w-2' : 'h-1.5 w-1.5'} ${statusClasses.dot}`}
      />
      <div className="min-w-0">
        <p className={`${size === 'base' ? 'text-sm' : 'text-xs'} font-medium ${statusClasses.label}`}>{label}</p>
        {detail && <p className={`${size === 'base' ? 'text-xs' : 'text-[11px]'} ${statusClasses.detail}`}>{detail}</p>}
      </div>
    </div>
  );
}

export function AgentActivityItem({
  part,
  liveActivity,
}: {
  readonly part: AgentActivityDataPart;
  readonly liveActivity?: AgentActivityDataChunk;
}) {
  const [expanded, setExpanded] = useState(false);

  if (part.data.status !== 'running' || (part.data.kind !== 'tool' && part.data.kind !== 'step')) {
    return null;
  }

  const runningLiveActivity = liveActivity?.data.status === 'running' ? liveActivity : undefined;
  const hasDetails = Boolean(part.data.detail || runningLiveActivity);
  const statusClasses = getStatusClasses(part.data.status);
  const label = part.data.label;

  return (
    <div className="my-2">
      {hasDetails ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${statusClasses.dot}`} />
          <span className={`text-sm font-medium ${statusClasses.label}`}>{label}</span>
          <span className="text-xs text-muted-foreground/70">{expanded ? '▾' : '▸'}</span>
        </button>
      ) : (
        <ActivityLine label={label} status={part.data.status} />
      )}
      {hasDetails && expanded ? (
        <div className="mt-1 space-y-1 pl-4">
          {part.data.detail ? <p className="text-xs text-muted-foreground">{part.data.detail}</p> : null}
          {runningLiveActivity ? (
            <ActivityLine
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
