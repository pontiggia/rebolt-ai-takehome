'use client';

interface ArtifactFallbackMessageProps {
  readonly message: string;
}

export function ArtifactFallbackMessage({ message }: ArtifactFallbackMessageProps) {
  return <p className="mb-3 text-[15px] leading-relaxed text-foreground">{message}</p>;
}
