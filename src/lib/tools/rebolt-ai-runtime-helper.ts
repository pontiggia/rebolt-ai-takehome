import {
  ARTIFACT_AI_MAX_PROMPT_CHARS,
  ARTIFACT_AI_REQUEST_MESSAGE_TYPE,
  ARTIFACT_AI_REQUEST_TIMEOUT_MS,
  ARTIFACT_AI_RESPONSE_MESSAGE_TYPE,
  ARTIFACT_AI_VALIDATION_ERROR_MARKER,
} from '../artifact/rebolt-ai-protocol';
import { REBOLT_AI_HELPER_PATH } from './constants';

export function buildReboltAIRuntimeHelper(): string {
  return `export type ReboltAIFormat = 'text' | 'json';

export interface ReboltAIRequest {
  prompt: string;
  system?: string;
  format?: ReboltAIFormat;
}

export type ReboltAIPromptInput = string | number | boolean | null | Record<string, unknown> | unknown[];
export type ReboltAIRequestInput = Omit<ReboltAIRequest, 'format'> | ReboltAIPromptInput;

declare global {
  interface Window {
    __REBOLT_ARTIFACT_RUNTIME_MODE__?: 'interactive' | 'validation';
  }
}

const REQUEST_TYPE = ${JSON.stringify(ARTIFACT_AI_REQUEST_MESSAGE_TYPE)};
const RESPONSE_TYPE = ${JSON.stringify(ARTIFACT_AI_RESPONSE_MESSAGE_TYPE)};
const REQUEST_TIMEOUT_MS = ${ARTIFACT_AI_REQUEST_TIMEOUT_MS};
const MAX_PROMPT_CHARS = ${ARTIFACT_AI_MAX_PROMPT_CHARS};
const VALIDATION_ERROR = ${JSON.stringify(
    `${ARTIFACT_AI_VALIDATION_ERROR_MARKER} Live AI is disabled during background validation.`,
  )};
const MAX_COMPACT_ARRAY_ITEMS = 20;
const MAX_COMPACT_OBJECT_ENTRIES = 40;
const MAX_COMPACT_STRING_CHARS = 280;
const MAX_COMPACT_DEPTH = 4;

function getRuntimeMode(): 'interactive' | 'validation' {
  if (typeof window === 'undefined') {
    return 'interactive';
  }

  return window.__REBOLT_ARTIFACT_RUNTIME_MODE__ === 'validation' ? 'validation' : 'interactive';
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return \`rebolt-ai-\${Date.now()}-\${Math.random().toString(16).slice(2)}\`;
}

function ensureRuntimeAvailability(): void {
  if (typeof window === 'undefined' || window.parent === window) {
    throw new Error('Rebolt AI is only available inside the Rebolt artifact runtime.');
  }

  if (getRuntimeMode() === 'validation') {
    throw new Error(VALIDATION_ERROR);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compactStructuredPrompt(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    if (value.length <= MAX_COMPACT_STRING_CHARS) {
      return value;
    }

    return \`\${value.slice(0, MAX_COMPACT_STRING_CHARS)}... [\${value.length - MAX_COMPACT_STRING_CHARS} more chars omitted]\`;
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (depth >= MAX_COMPACT_DEPTH) {
    if (Array.isArray(value)) {
      return \`[\${value.length} items omitted at depth limit]\`;
    }

    return '[Object omitted at depth limit]';
  }

  if (Array.isArray(value)) {
    const trimmed = value.slice(0, MAX_COMPACT_ARRAY_ITEMS).map((entry) => compactStructuredPrompt(entry, depth + 1));

    if (value.length > MAX_COMPACT_ARRAY_ITEMS) {
      trimmed.push(\`[\${value.length - MAX_COMPACT_ARRAY_ITEMS} more items omitted]\`);
    }

    return trimmed;
  }

  const entries = Object.entries(value);
  const compactedEntries = entries
    .slice(0, MAX_COMPACT_OBJECT_ENTRIES)
    .map(([key, entryValue]) => [key, compactStructuredPrompt(entryValue, depth + 1)] as const);

  if (entries.length > MAX_COMPACT_OBJECT_ENTRIES) {
    compactedEntries.push([
      '__reboltOmittedKeys',
      \`\${entries.length - MAX_COMPACT_OBJECT_ENTRIES} additional keys omitted\`,
    ]);
  }

  return Object.fromEntries(compactedEntries);
}

function serializePromptValue(value: unknown, options: { compact: boolean; context: 'prompt' | 'request' }): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      throw new Error(
        'Rebolt AI requires a non-empty prompt string. Use callReboltAIJson({ prompt: "...", system: "Return JSON only." }).',
      );
    }

    if (trimmed.length > MAX_PROMPT_CHARS) {
      throw new Error(
        \`Rebolt AI prompts must stay under \${MAX_PROMPT_CHARS} characters. Summarize the dataset with profile stats, aggregates, and a tiny sample instead of sending raw rows.\`,
      );
    }

    return trimmed;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'undefined') {
    throw new Error(
      options.context === 'request'
        ? 'Rebolt AI shorthand requests must be a string or JSON-serializable object.'
        : 'Rebolt AI requires a non-empty prompt string. Use callReboltAIJson({ prompt: "...", system: "Return JSON only." }).',
    );
  }

  try {
    const serialized = JSON.stringify(options.compact ? compactStructuredPrompt(value) : value);

    if (!serialized || serialized.length === 0) {
      throw new Error('Rebolt AI could not serialize the provided prompt payload.');
    }

    if (serialized.length > MAX_PROMPT_CHARS) {
      throw new Error(
        \`Rebolt AI prompts must stay under \${MAX_PROMPT_CHARS} characters. Use dataset.profile, aggregate stats, and at most a tiny representative sample instead of large raw row arrays.\`,
      );
    }

    return serialized;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Rebolt AI could not serialize the provided prompt payload.');
  }
}

function normalizeSystemValue(value: unknown): string | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error('Rebolt AI system prompts must be strings.');
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length > MAX_PROMPT_CHARS) {
    throw new Error(\`Rebolt AI system prompts must stay under \${MAX_PROMPT_CHARS} characters.\`);
  }

  return trimmed;
}

function normalizeFormatValue(value: unknown, fallback: ReboltAIFormat): ReboltAIFormat {
  if (typeof value === 'undefined') {
    return fallback;
  }

  if (value === 'text' || value === 'json') {
    return value;
  }

  throw new Error('Rebolt AI format must be either "text" or "json".');
}

function normalizeRequest(request: ReboltAIRequestInput, fallbackFormat: ReboltAIFormat): ReboltAIRequest {
  if (typeof request === 'string' || typeof request === 'number' || typeof request === 'boolean' || request === null) {
    return {
      prompt: serializePromptValue(request, { compact: false, context: 'prompt' }),
      format: fallbackFormat,
    };
  }

  if (!isPlainObject(request) && !Array.isArray(request)) {
    throw new Error(
      'Rebolt AI requests must be a string, a JSON-serializable prompt object, or { prompt, system? }.',
    );
  }

  if (Array.isArray(request)) {
    return {
      prompt: serializePromptValue(request, { compact: true, context: 'request' }),
      format: fallbackFormat,
    };
  }

  const hasExplicitRequestShape = 'prompt' in request || 'system' in request;

  if (!hasExplicitRequestShape) {
    return {
      prompt: serializePromptValue(request, { compact: true, context: 'request' }),
      format: normalizeFormatValue(request.format, fallbackFormat),
    };
  }

  return {
    prompt: serializePromptValue(request.prompt, { compact: typeof request.prompt !== 'string', context: 'prompt' }),
    system: normalizeSystemValue(request.system),
    format: normalizeFormatValue(request.format, fallbackFormat),
  };
}

function isResponseMessage(
  value: unknown,
  requestId: string,
): value is { type: string; requestId: string; ok: boolean; output?: unknown; error?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === RESPONSE_TYPE &&
    'requestId' in value &&
    value.requestId === requestId &&
    'ok' in value &&
    typeof value.ok === 'boolean'
  );
}

export async function callReboltAI<T = unknown>(
  request: ReboltAIRequestInput,
  options: { format?: ReboltAIFormat } = {},
): Promise<T> {
  ensureRuntimeAvailability();
  const normalizedRequest = normalizeRequest(request, options.format ?? 'text');

  const requestId = createRequestId();

  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Rebolt AI request timed out.'));
    }, REQUEST_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', handleMessage);
    };

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isResponseMessage(event.data, requestId)) {
        return;
      }

      cleanup();

      if (!event.data.ok) {
        reject(new Error(typeof event.data.error === 'string' ? event.data.error : 'Rebolt AI request failed.'));
        return;
      }

      resolve(event.data.output as T);
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage(
      {
        type: REQUEST_TYPE,
        requestId,
        payload: {
          prompt: normalizedRequest.prompt,
          system: normalizedRequest.system,
          format: normalizedRequest.format ?? 'text',
        },
      },
      '*',
    );
  });
}

export function callReboltAIText(request: ReboltAIRequestInput): Promise<string> {
  return callReboltAI<string>(request, {
    format: 'text',
  });
}

export function callReboltAIJson<T = Record<string, unknown>>(request: ReboltAIRequestInput): Promise<T> {
  return callReboltAI<T>(request, {
    format: 'json',
  });
}
`;
}

export function buildReboltAIExportStub(): string {
  return `export type ReboltAIFormat = 'text' | 'json';

export interface ReboltAIRequest {
  prompt: string;
  system?: string;
  format?: ReboltAIFormat;
}

export type ReboltAIPromptInput = string | number | boolean | null | Record<string, unknown> | unknown[];
export type ReboltAIRequestInput = Omit<ReboltAIRequest, 'format'> | ReboltAIPromptInput;

const EXPORT_ERROR =
  'This artifact uses Rebolt AI, which only works inside the Rebolt app. Replace /src/rebolt-ai.ts with your own backend integration to enable live inference outside Rebolt.';

export async function callReboltAI<T = unknown>(
  _request: ReboltAIRequestInput,
  _options: { format?: ReboltAIFormat } = {},
): Promise<T> {
  throw new Error(EXPORT_ERROR);
}

export function callReboltAIText(request: ReboltAIRequestInput): Promise<string> {
  return callReboltAI<string>(request, {
    format: 'text',
  });
}

export function callReboltAIJson<T = Record<string, unknown>>(request: ReboltAIRequestInput): Promise<T> {
  return callReboltAI<T>(request, {
    format: 'json',
  });
}
`;
}

export function injectReboltAIRuntimeHelper(
  files: Readonly<Record<string, string>>,
  useReboltAI: boolean,
): Record<string, string> {
  if (!useReboltAI) {
    return { ...files };
  }

  return {
    ...files,
    [REBOLT_AI_HELPER_PATH]: buildReboltAIRuntimeHelper(),
  };
}
