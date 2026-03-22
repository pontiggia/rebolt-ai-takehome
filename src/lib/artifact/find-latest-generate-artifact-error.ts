interface GenerateArtifactPartLike {
  readonly state?: string;
  readonly errorText?: string | null;
}

interface FindLatestGenerateArtifactErrorOptions<TMessage, TPart> {
  readonly getRole: (message: TMessage) => string;
  readonly getParts: (message: TMessage) => readonly TPart[];
  readonly getGenerateArtifactPart: (part: TPart) => GenerateArtifactPartLike | null;
}

export function findLatestGenerateArtifactErrorPart<TMessage, TPart>(
  messages: readonly TMessage[],
  options: FindLatestGenerateArtifactErrorOptions<TMessage, TPart>,
): { readonly message: TMessage; readonly part: TPart; readonly errorText: string } | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (options.getRole(message) !== 'assistant') {
      continue;
    }

    const parts = options.getParts(message);
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      const generateArtifactPart = options.getGenerateArtifactPart(part);
      if (!generateArtifactPart) {
        continue;
      }

      if (generateArtifactPart.state !== 'output-error' || !generateArtifactPart.errorText) {
        return null;
      }

      return {
        message,
        part,
        errorText: generateArtifactPart.errorText,
      };
    }
  }

  return null;
}
