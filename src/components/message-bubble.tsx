'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { AnalysisToolOutput, ArtifactToolOutput } from '@/types/ai';
import type { UIMessage } from 'ai';

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%]', isUser && 'rounded-2xl bg-primary/10 px-4 py-2')}>
        <div className="prose prose-sm max-w-none">
          {message.parts.map((part, i) => {
            if (part.type === 'text') {
              return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>;
            }

            // Tool parts have type like 'tool-analyzeData' or 'tool-generateArtifact'
            if (part.type.startsWith('tool-')) {
              const toolName = part.type.slice(5);
              return <ToolInvocationPart key={i} toolName={toolName} part={part} />;
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolInvocationPart({ toolName, part }: { toolName: string; part: any }) {
  const [expanded, setExpanded] = useState(false);

  if (toolName === 'analyzeData') {
    if (part.state === 'input-streaming' || part.state === 'input-available') {
      return (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <span className="animate-pulse">●</span> Analyzing data...
        </div>
      );
    }
    if (part.state === 'output-available') {
      const result = part.output as AnalysisToolOutput;
      return (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className={cn('transition-transform', expanded && 'rotate-90')}>▶</span>
            Analysis
          </button>
          {expanded && (
            <div className="border-l pl-4 text-sm text-muted-foreground">
              <p>{result.summary}</p>
              {result.insights.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {result.insights.map((insight, j) => (
                    <li key={j}>{insight}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      );
    }
  }

  if (toolName === 'generateArtifact') {
    if (part.state === 'input-streaming' || part.state === 'input-available') {
      return (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <span className="animate-pulse">●</span> Generating visualization...
        </div>
      );
    }
    if (part.state === 'output-available') {
      const result = part.output as ArtifactToolOutput;
      return (
        <div className="my-2 flex cursor-pointer items-center gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium">{result.title}</p>
            <p className="text-xs text-muted-foreground">Interactive artifact</p>
          </div>
        </div>
      );
    }
  }

  return null;
}
