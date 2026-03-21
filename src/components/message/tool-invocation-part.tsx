'use client';

import { ArtifactCard } from '@/components/artifact/artifact-card';
import { CollapsibleSection } from '@/components/message/collapsible-section';
import { describeReadDatasetRowsOutput } from '@/lib/agent-activity';
import type {
  AnalyzeDataToolInvocation,
  ArtifactToolInput,
  GenerateArtifactToolInvocation,
  ReadDatasetRowsToolInvocation,
} from '@/types/ai';

function ToolErrorSection({ label, error, description }: { label: string; error: string; description?: string }) {
  return (
    <CollapsibleSection label={label}>
      {description && <p className="mb-2 text-sm text-muted-foreground">{description}</p>}
      <p className="text-sm text-destructive">{error}</p>
    </CollapsibleSection>
  );
}

export function AnalyzeDataToolPart({ part }: { readonly part: AnalyzeDataToolInvocation }) {
  if (part.state === 'output-error') {
    return <ToolErrorSection label="Analysis failed" error={part.errorText} />;
  }

  if (part.state !== 'output-available') {
    return null;
  }

  return (
    <CollapsibleSection label="Analysis">
      <p>{part.output.summary}</p>
      {part.output.insights.length > 0 && (
        <ul className="mt-1 list-disc pl-4">
          {part.output.insights.map((insight, index) => (
            <li key={index}>{insight}</li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  );
}

export function ReadDatasetRowsToolPart({ part }: { readonly part: ReadDatasetRowsToolInvocation }) {
  if (part.state === 'output-error') {
    return <ToolErrorSection label="Dataset inspection failed" error={part.errorText} />;
  }

  if (part.state !== 'output-available') {
    return null;
  }

  return (
    <CollapsibleSection label="Dataset inspection">
      <p>{describeReadDatasetRowsOutput(part.output)}</p>
    </CollapsibleSection>
  );
}

export function GenerateArtifactToolInstructionsPart({ part }: { readonly part: GenerateArtifactToolInvocation }) {
  if (part.state === 'output-error') {
    const input = part.input as Partial<ArtifactToolInput> | undefined;
    return (
      <ToolErrorSection label="Artifact generation failed" error={part.errorText} description={input?.description} />
    );
  }

  if (part.state !== 'output-available') {
    return null;
  }

  if (!part.input.description) {
    return null;
  }

  return (
    <CollapsibleSection label="Instructions sent to code generator">
      <p>{part.input.description}</p>
    </CollapsibleSection>
  );
}

export function GenerateArtifactToolCardPart({
  part,
  onArtifactClick,
}: {
  readonly part: GenerateArtifactToolInvocation;
  readonly onArtifactClick?: () => void;
}) {
  if (part.state !== 'output-available') {
    return null;
  }

  return <ArtifactCard title={part.output.title} onClick={onArtifactClick} />;
}
