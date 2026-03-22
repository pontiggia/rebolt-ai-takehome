import {
  OPENAI_RESPONSES_API_URL,
  REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE,
  REBOLT_OPENAI_PROXY_REQUEST_TIMEOUT_MS,
  REBOLT_OPENAI_PROXY_RESPONSE_MESSAGE_TYPE,
  REBOLT_OPENAI_PROXY_VALIDATION_ERROR_MARKER,
} from '../artifact/rebolt-openai-proxy-protocol';
import { REBOLT_OPENAI_PROXY_PATH } from './constants';

const OPENAI_PROXY_IMPORT = `import './rebolt-openai-proxy';`;

function injectOpenAIProxyImport(appSource: string): string {
  if (appSource.includes(OPENAI_PROXY_IMPORT)) {
    return appSource;
  }

  const directiveMatch = appSource.match(/^(?:\s*['"]use (?:client|server)['"];?\s*\n)+/);
  if (!directiveMatch) {
    return `${OPENAI_PROXY_IMPORT}\n${appSource}`;
  }

  return `${directiveMatch[0]}${OPENAI_PROXY_IMPORT}\n${appSource.slice(directiveMatch[0].length)}`;
}

export function buildReboltOpenAIProxyRuntimeHelper(): string {
  return `declare global {
  interface Window {
    __REBOLT_ARTIFACT_RUNTIME_MODE__?: 'interactive' | 'validation';
    __REBOLT_OPENAI_PROXY_INSTALLED__?: boolean;
  }
}

const REQUEST_TYPE = ${JSON.stringify(REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE)};
const RESPONSE_TYPE = ${JSON.stringify(REBOLT_OPENAI_PROXY_RESPONSE_MESSAGE_TYPE)};
const REQUEST_TIMEOUT_MS = ${REBOLT_OPENAI_PROXY_REQUEST_TIMEOUT_MS};
const TARGET_URL = ${JSON.stringify(OPENAI_RESPONSES_API_URL)};
const VALIDATION_ERROR = ${JSON.stringify(
    `${REBOLT_OPENAI_PROXY_VALIDATION_ERROR_MARKER} Live OpenAI proxy calls are disabled during background validation.`,
  )};
const BLOCKED_HEADER_PATTERN = /^(authorization|x-api-key|api-key|openai-organization|openai-project)$/i;
const ALLOWED_HEADER_NAMES = new Set(['accept', 'content-type']);

interface SerializedProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

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

  return \`rebolt-openai-proxy-\${Date.now()}-\${Math.random().toString(16).slice(2)}\`;
}

function isOpenAIResponsesRequest(request: Request): boolean {
  return request.method.toUpperCase() === 'POST' && request.url === TARGET_URL;
}

function sanitizeHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};

  headers.forEach((value, rawName) => {
    const name = rawName.trim().toLowerCase();
    if (!name || BLOCKED_HEADER_PATTERN.test(name) || !ALLOWED_HEADER_NAMES.has(name)) {
      return;
    }

    sanitized[name] = value;
  });

  if (!sanitized['content-type']) {
    sanitized['content-type'] = 'application/json';
  }

  return sanitized;
}

function isResponseMessage(
  value: unknown,
  requestId: string,
): value is { type: string; requestId: string; ok: boolean; response?: SerializedProxyResponse; error?: string } {
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

async function proxyOpenAIRequest(request: Request): Promise<Response> {
  if (typeof window === 'undefined' || window.parent === window) {
    throw new Error('Rebolt OpenAI proxy is only available inside the Rebolt artifact runtime.');
  }

  if (getRuntimeMode() === 'validation') {
    throw new Error(VALIDATION_ERROR);
  }

  const requestId = createRequestId();
  const body = await request.text();

  return new Promise<Response>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Rebolt OpenAI proxy request timed out.'));
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

      if (!event.data.ok || !event.data.response) {
        reject(
          new Error(
            typeof event.data.error === 'string' ? event.data.error : 'Rebolt OpenAI proxy request failed.',
          ),
        );
        return;
      }

      resolve(
        new Response(event.data.response.body, {
          status: event.data.response.status,
          statusText: event.data.response.statusText,
          headers: event.data.response.headers,
        }),
      );
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage(
      {
        type: REQUEST_TYPE,
        requestId,
        payload: {
          url: TARGET_URL,
          method: 'POST',
          headers: sanitizeHeaders(request.headers),
          body,
        },
      },
      '*',
    );
  });
}

export function installReboltOpenAIProxy(): void {
  if (typeof window === 'undefined' || window.__REBOLT_OPENAI_PROXY_INSTALLED__) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (!isOpenAIResponsesRequest(request)) {
      return originalFetch(input, init);
    }

    return proxyOpenAIRequest(request);
  };

  window.__REBOLT_OPENAI_PROXY_INSTALLED__ = true;
}

installReboltOpenAIProxy();
`;
}

export function buildReboltOpenAIProxyExportStub(): string {
  return `const TARGET_URL = ${JSON.stringify(OPENAI_RESPONSES_API_URL)};
const EXPORT_ERROR =
  'This artifact uses the Rebolt OpenAI proxy, which only works inside the Rebolt app. Replace /src/rebolt-openai-proxy.ts with your own backend integration to enable live OpenAI Responses API calls outside Rebolt.';

declare global {
  interface Window {
    __REBOLT_OPENAI_PROXY_STUB_INSTALLED__?: boolean;
  }
}

export function installReboltOpenAIProxy(): void {
  if (typeof window === 'undefined' || window.__REBOLT_OPENAI_PROXY_STUB_INSTALLED__) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.method.toUpperCase() !== 'POST' || request.url !== TARGET_URL) {
      return originalFetch(input, init);
    }

    throw new Error(EXPORT_ERROR);
  };

  window.__REBOLT_OPENAI_PROXY_STUB_INSTALLED__ = true;
}

installReboltOpenAIProxy();
`;
}

export function injectReboltOpenAIProxyRuntimeHelper(
  files: Readonly<Record<string, string>>,
  useReboltAI: boolean,
): Record<string, string> {
  if (!useReboltAI) {
    return { ...files };
  }

  const appSource = files['/src/App.tsx'];
  if (!appSource) {
    throw new Error('Artifacts that use Rebolt AI must define /src/App.tsx.');
  }

  return {
    ...files,
    '/src/App.tsx': injectOpenAIProxyImport(appSource),
    [REBOLT_OPENAI_PROXY_PATH]: buildReboltOpenAIProxyRuntimeHelper(),
  };
}
