import type { AgentActivityDataChunk, AgentActivityDataPart } from '@/types/ai';

export function getAgentActivityStatusClasses(
  status: AgentActivityDataPart['data']['status'] | AgentActivityDataChunk['data']['status'],
) {
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
