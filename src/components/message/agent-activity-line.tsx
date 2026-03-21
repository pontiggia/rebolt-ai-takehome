'use client';

import { getAgentActivityStatusClasses } from '@/lib/message/agent-activity-styles';
import type { AgentActivityDataChunk, AgentActivityDataPart } from '@/types/ai';

interface AgentActivityLineProps {
  readonly label: string;
  readonly detail?: string;
  readonly status: AgentActivityDataPart['data']['status'] | AgentActivityDataChunk['data']['status'];
  readonly size?: 'base' | 'detail';
}

export function AgentActivityLine({ label, detail, status, size = 'base' }: AgentActivityLineProps) {
  const statusClasses = getAgentActivityStatusClasses(status);

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
