'use client';

import type { AnalysisToolOutput, ArtifactToolInput, ArtifactToolOutput } from '@/types/ai';
import { ToolLoadingIndicator } from '@/components/tool-loading-indicator';
import { CollapsibleSection } from '@/components/collapsible-section';
import { ArtifactCard } from '@/components/artifact-card';

function ToolErrorSection({ label, error, description }: { label: string; error: string; description?: string }) {
  return (
    <CollapsibleSection label={label}>
      {description && <p className="mb-2 text-sm text-muted-foreground">{description}</p>}
      <p className="text-sm text-destructive">{error}</p>
    </CollapsibleSection>
  );
}

export function ToolInvocationPart({
  toolName,
  part,
  onArtifactClick,
  mode,
}: {
  toolName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part: any;
  onArtifactClick?: () => void;
  mode?: 'instructions' | 'card';
}) {
  if (part.state === 'input-streaming' || part.state === 'input-available') {
    if (toolName === 'analyzeData') return <ToolLoadingIndicator label="Analyzing data..." />;
    if (toolName === 'generateArtifact') return <ToolLoadingIndicator label="Generating visualization..." />;
  }

  if (part.state === 'output-error') {
    if (toolName === 'generateArtifact' && mode === 'card') {
      return null;
    }

    if (toolName === 'generateArtifact') {
      const input = part.input as Partial<ArtifactToolInput> | undefined;
      return (
        <ToolErrorSection
          label="Artifact generation failed"
          error={part.errorText}
          description={mode === 'instructions' ? input?.description : undefined}
        />
      );
    }

    if (toolName === 'analyzeData') {
      return <ToolErrorSection label="Analysis failed" error={part.errorText} />;
    }

    return <ToolErrorSection label={`${toolName} failed`} error={part.errorText} />;
  }

  if (part.state !== 'output-available') return null;

  if (toolName === 'analyzeData') {
    const result = part.output as AnalysisToolOutput;
    return (
      <CollapsibleSection label="Analysis">
        <p>{result.summary}</p>
        {result.insights.length > 0 && (
          <ul className="mt-1 list-disc pl-4">
            {result.insights.map((insight, j) => (
              <li key={j}>{insight}</li>
            ))}
          </ul>
        )}
      </CollapsibleSection>
    );
  }

  if (toolName === 'generateArtifact') {
    const result = part.output as ArtifactToolOutput;
    const input = part.input as ArtifactToolInput;

    if (mode === 'instructions') {
      if (!input?.description) return null;
      return (
        <CollapsibleSection label="Instructions sent to code generator">
          <p>{input.description}</p>
        </CollapsibleSection>
      );
    }

    if (mode === 'card') {
      return <ArtifactCard title={result.title} onClick={onArtifactClick} />;
    }
  }

  return null;
}
