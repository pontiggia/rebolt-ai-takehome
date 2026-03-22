import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { findLatestGenerateArtifactErrorPart } from '../src/lib/artifact/find-latest-generate-artifact-error';
import {
  OPENAI_RESPONSES_API_URL,
  REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE,
  REBOLT_OPENAI_PROXY_RESPONSE_MESSAGE_TYPE,
} from '../src/lib/artifact/rebolt-openai-proxy-protocol';
import { relayArtifactOpenAIProxyRequest } from '../src/lib/artifact/rebolt-openai-proxy-bridge';
import { lintArtifactFiles } from '../src/lib/tools/artifact-static-validator';
import { REBOLT_OPENAI_PROXY_PATH } from '../src/lib/tools/constants';
import {
  buildReboltOpenAIProxyExportStub,
  injectReboltOpenAIProxyRuntimeHelper,
} from '../src/lib/tools/rebolt-openai-proxy-runtime-helper';

const BAD_ARTIFACT_FIXTURE_PATH = new URL('../issue-fix/bad_artifact_code.tsx', import.meta.url);
const SYSTEM_PROMPT_PATH = new URL('../src/lib/system-prompt.ts', import.meta.url);
const SYSTEM_PROMPT_DATA_PATH = new URL('../src/lib/system-prompt-data.ts', import.meta.url);
const SYSTEM_PROMPT_SECTIONS_PATH = new URL('../src/lib/system-prompt-sections.ts', import.meta.url);
const CREATE_GENERATE_ARTIFACT_TOOL_PATH = new URL('../src/lib/tools/create-generate-artifact-tool.ts', import.meta.url);
const TOOLS_PATH = new URL('../src/lib/tools.ts', import.meta.url);
const VALIDATE_UI_MESSAGES_PATH = new URL('../src/lib/chat/validate-app-ui-messages.ts', import.meta.url);
const ARTIFACT_OPENAI_PROXY_SERVICE_PATH = new URL('../src/services/artifact-openai-proxy.ts', import.meta.url);
const ARTIFACT_STATIC_VALIDATION_ERROR_MARKER = '[artifact-static-validation]';

interface OpenAIProxyResponseMessage {
  readonly type: string;
  readonly requestId: string;
  readonly ok: boolean;
  readonly response?: {
    readonly status: number;
    readonly body: string;
  };
  readonly error?: string;
}

type LintOptions = Parameters<typeof lintArtifactFiles>[1];

async function runTest(name: string, testFn: () => void | Promise<void>): Promise<void> {
  await testFn();
  console.log(`PASS ${name}`);
}

function expectStaticValidationFailure(
  files: Readonly<Record<string, string>>,
  options: LintOptions,
  expectedText: string,
): void {
  assert.throws(
    () => {
      lintArtifactFiles(files, options);
    },
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(ARTIFACT_STATIC_VALIDATION_ERROR_MARKER) &&
      error.message.includes(expectedText),
  );
}

function createSourceRecorder() {
  const messages: Array<{ message: unknown; targetOrigin: string }> = [];

  return {
    messages,
    source: {
      postMessage(message: unknown, targetOrigin: string) {
        messages.push({ message, targetOrigin });
      },
    },
  };
}

function loadBadArtifactFixture(): string {
  if (existsSync(BAD_ARTIFACT_FIXTURE_PATH)) {
    return readFileSync(BAD_ARTIFACT_FIXTURE_PATH, 'utf8');
  }

  return `export default async function App() {
  const response = await fetch('http://localhost:5000/predict', { method: 'POST' });
  return <div>{response.status}</div>;
}`;
}

async function main(): Promise<void> {
  await runTest('rejects the YC bad artifact fixture with a static validation error', () => {
    const badArtifactCode = loadBadArtifactFixture();

    expectStaticValidationFailure(
      {
        '/src/App.tsx': badArtifactCode,
      },
      { useReboltAI: false },
      'localhost',
    );
  });

  await runTest('ignores stale artifact tool errors once a newer artifact attempt succeeds', () => {
    type ArtifactTestPart =
      | {
          readonly type: 'tool-generateArtifact';
          readonly toolCallId: string;
          readonly state: 'output-error';
          readonly errorText: string;
          readonly input: {
            readonly title: string;
            readonly description: string;
          };
        }
      | {
          readonly type: 'tool-generateArtifact';
          readonly toolCallId: string;
          readonly state: 'output-available';
          readonly input: {
            readonly title: string;
            readonly description: string;
          };
          readonly output: {
            readonly title: string;
            readonly fileId: string;
            readonly usesReboltAI: boolean;
            readonly files: Readonly<Record<string, string>>;
          };
        };

    type ArtifactTestMessage = {
      readonly id: string;
      readonly role: 'assistant';
      readonly parts: readonly ArtifactTestPart[];
    };

    const messages: ArtifactTestMessage[] = [
      {
        id: 'assistant-error',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateArtifact',
            toolCallId: 'call-error',
            state: 'output-error',
            errorText: 'Artifact generation failed.',
            input: {
              title: 'Housing artifact',
              description: 'Initial failed attempt',
            },
          },
        ],
      },
      {
        id: 'assistant-success',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateArtifact',
            toolCallId: 'call-success',
            state: 'output-available',
            input: {
              title: 'Housing artifact',
              description: 'Retry succeeded',
            },
            output: {
              title: 'Housing artifact',
              fileId: 'fixture-file',
              usesReboltAI: true,
              files: {
                '/src/App.tsx': 'export default function App() { return null; }',
              },
            },
          },
        ],
      },
    ];

    const latestError = findLatestGenerateArtifactErrorPart(messages, {
      getRole: (message) => message.role,
      getParts: (message) => message.parts,
      getGenerateArtifactPart: (part) => (part.type === 'tool-generateArtifact' ? part : null),
    });

    assert.equal(latestError, null);
  });

  await runTest('allows a public weather API artifact without Rebolt AI', () => {
    assert.doesNotThrow(() => {
      lintArtifactFiles(
        {
          '/src/App.tsx': `export default async function App() {
  const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.7&longitude=-74&hourly=temperature_2m');
  return <div>{response.ok ? 'ok' : 'bad'}</div>;
}`,
        },
        { useReboltAI: false },
      );
    });
  });

  await runTest('rejects OpenAI Responses API usage when Rebolt AI is disabled', () => {
    expectStaticValidationFailure(
      {
        '/src/App.tsx': `export default async function App() {
  const response = await fetch('${OPENAI_RESPONSES_API_URL}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4.1', input: 'hello' }),
  });
  return <div>{response.status}</div>;
}`,
      },
      { useReboltAI: false },
      'Rebolt AI is not enabled',
    );
  });

  await runTest('accepts direct OpenAI Responses API usage when Rebolt AI is enabled', () => {
    assert.doesNotThrow(() => {
      lintArtifactFiles(
        {
          '/src/App.tsx': `export default async function App() {
  const response = await fetch('${OPENAI_RESPONSES_API_URL}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1',
      input: 'Estimate the likely median house value from compact dataset stats.',
    }),
  });
  return <div>{response.status}</div>;
}`,
        },
        { useReboltAI: true },
      );
    });
  });

  await runTest('rejects unsupported provider patterns and fake trained-model claims', () => {
    const invalidArtifacts = [
      {
        name: 'anthropic endpoint',
        files: {
          '/src/App.tsx': `export default async function App() {
  await fetch('https://api.anthropic.com/v1/messages');
  return <div>Bad</div>;
}`,
        },
        expected: 'non-OpenAI provider',
      },
      {
        name: 'wrong OpenAI endpoint',
        files: {
          '/src/App.tsx': `export default async function App() {
  await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST' });
  return <div>Bad</div>;
}`,
        },
        expected: 'Only https://api.openai.com/v1/responses is supported',
      },
      {
        name: 'auth header',
        files: {
          '/src/App.tsx': `export default async function App() {
  await fetch('${OPENAI_RESPONSES_API_URL}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer bad',
    },
    body: JSON.stringify({ model: 'gpt-4.1', input: 'hello' }),
  });
  return <div>Bad</div>;
}`,
        },
        expected: 'must not send Authorization',
      },
      {
        name: 'legacy helper',
        files: {
          '/src/App.tsx': `import { callReboltAIJson } from './rebolt-ai';

export default function App() {
  void callReboltAIJson({ prompt: 'hello' });
  return <div>Bad</div>;
}`,
        },
        expected: 'Do not import or call "./rebolt-ai"',
      },
      {
        name: 'legacy predict helper',
        files: {
          '/src/App.tsx': `import { predictTabularRow } from './rebolt-predict';
export default function App() {
  void predictTabularRow({ input: { value: 1 } });
  return <div>Bad</div>;
}`,
        },
        expected: 'legacy "./rebolt-predict" helper has been removed',
      },
      {
        name: 'fake model claim',
        files: {
          '/src/App.tsx': `export default async function App() {
  const response = await fetch('${OPENAI_RESPONSES_API_URL}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4.1', input: 'hello' }),
  });

  return <div>Trained XGBoost with RMSE 123</div>;
}`,
        },
        expected: 'must stay truthful',
      },
    ] as const;

    for (const artifact of invalidArtifacts) {
      expectStaticValidationFailure(artifact.files, { useReboltAI: true }, artifact.expected);
    }
  });

  await runTest('rejects env access and hardcoded secrets', () => {
    const invalidArtifacts = [
      {
        files: {
          '/src/App.tsx': `export default function App() {
  return <div>{process.env.OPENAI_API_KEY}</div>;
}`,
        },
        expected: 'process.env',
      },
      {
        files: {
          '/src/App.tsx': `const apiKey = 'sk-test-secret-secret-secret';
export default function App() {
  return <div>{apiKey}</div>;
}`,
        },
        expected: 'provider secrets',
      },
    ] as const;

    for (const artifact of invalidArtifacts) {
      expectStaticValidationFailure(artifact.files, { useReboltAI: false }, artifact.expected);
    }
  });

  await runTest('prompt and tool source files describe the OpenAI proxy contract and omit prediction tooling', () => {
    const systemPromptSource = readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
    const systemPromptDataSource = readFileSync(SYSTEM_PROMPT_DATA_PATH, 'utf8');
    const systemPromptSectionsSource = readFileSync(SYSTEM_PROMPT_SECTIONS_PATH, 'utf8');
    const createGenerateArtifactToolSource = readFileSync(CREATE_GENERATE_ARTIFACT_TOOL_PATH, 'utf8');

    assert.ok(systemPromptSource.includes(OPENAI_RESPONSES_API_URL));
    assert.ok(systemPromptDataSource.includes('model: "gpt-4.1"'));
    assert.ok(systemPromptSectionsSource.includes('useReboltAI: true'));
    assert.ok(createGenerateArtifactToolSource.includes('useReboltAI'));
    assert.ok(systemPromptSource.includes('buildOpenAIProxyRuntimeInstruction'));

    assert.ok(!systemPromptSource.includes('analyzePredictionSchema'));
    assert.ok(!systemPromptSource.includes('buildReboltAIRuntimeInstruction'));
    assert.ok(!systemPromptSource.includes('./rebolt-predict'));
    assert.ok(!createGenerateArtifactToolSource.includes('useReboltPrediction'));
    assert.ok(!createGenerateArtifactToolSource.includes('predictionSpec'));
  });

  await runTest('chat tool registry no longer exposes analyzePredictionSchema', () => {
    const toolsSource = readFileSync(TOOLS_PATH, 'utf8');
    assert.ok(toolsSource.includes('analyzeData: createAnalyzeDataTool(fileData)'));
    assert.ok(toolsSource.includes('readDatasetRows: createReadDatasetRowsTool(fileData)'));
    assert.ok(toolsSource.includes('generateArtifact: createGenerateArtifactTool(fileData)'));
    assert.ok(!toolsSource.includes('analyzePredictionSchema'));
  });

  await runTest('legacy analyzePredictionSchema message parts are stripped during validation', () => {
    const validateSource = readFileSync(VALIDATE_UI_MESSAGES_PATH, 'utf8');
    assert.ok(validateSource.includes("part.type === 'tool-analyzePredictionSchema'"));
    assert.ok(validateSource.includes('parts: message.parts.filter('));
  });

  await runTest('relayArtifactOpenAIProxyRequest round-trips proxy responses through postMessage', async () => {
    const { messages, source } = createSourceRecorder();
    let fetchBody: Record<string, unknown> | null = null;
    let fetchUrl = '';

    const handled = await relayArtifactOpenAIProxyRequest({
      data: {
        type: REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE,
        requestId: 'request-1',
        payload: {
          url: OPENAI_RESPONSES_API_URL,
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model: 'gpt-4.1', input: 'hello' }),
        },
      },
      origin: 'https://rebolt.app',
      source,
      conversationId: '4aa6c03d-090d-4fe3-a5f1-a403e43f5b4c',
      artifact: {
        fileId: '94a2b9fc-7d0a-4994-9d9b-76d684d2eff1',
        usesReboltAI: true,
      },
      fetchImpl: async (url, init) => {
        fetchUrl = String(url);
        fetchBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ output_text: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    assert.equal(handled, true);
    assert.equal(fetchUrl, '/api/conversations/4aa6c03d-090d-4fe3-a5f1-a403e43f5b4c/artifacts/responses');
    assert.deepEqual(fetchBody, {
      fileId: '94a2b9fc-7d0a-4994-9d9b-76d684d2eff1',
      url: OPENAI_RESPONSES_API_URL,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-4.1', input: 'hello' }),
    });

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.targetOrigin, 'https://rebolt.app');
    const response = messages[0]?.message as OpenAIProxyResponseMessage;
    assert.equal(response.type, REBOLT_OPENAI_PROXY_RESPONSE_MESSAGE_TYPE);
    assert.equal(response.requestId, 'request-1');
    assert.equal(response.ok, true);
    assert.equal(response.response?.status, 200);
    assert.equal(response.response?.body, JSON.stringify({ output_text: 'ok' }));
  });

  await runTest('relayArtifactOpenAIProxyRequest returns an error message when AI is disabled', async () => {
    const { messages, source } = createSourceRecorder();

    const handled = await relayArtifactOpenAIProxyRequest({
      data: {
        type: REBOLT_OPENAI_PROXY_REQUEST_MESSAGE_TYPE,
        requestId: 'request-disabled',
        payload: {
          url: OPENAI_RESPONSES_API_URL,
          method: 'POST',
          headers: {},
          body: JSON.stringify({ model: 'gpt-4.1', input: 'hello' }),
        },
      },
      origin: 'https://rebolt.app',
      source,
      conversationId: '4aa6c03d-090d-4fe3-a5f1-a403e43f5b4c',
      artifact: {
        fileId: null,
        usesReboltAI: false,
      },
    });

    assert.equal(handled, true);
    const response = messages[0]?.message as OpenAIProxyResponseMessage;
    assert.equal(response.ok, false);
    assert.match(response.error ?? '', /does not have Rebolt AI enabled/i);
  });

  await runTest('OpenAI proxy service source forces the model contract and injects auth server-side', () => {
    const serviceSource = readFileSync(ARTIFACT_OPENAI_PROXY_SERVICE_PATH, 'utf8');
    assert.ok(serviceSource.includes("const OPENAI_MODEL_ID = 'gpt-4.1'"));
    assert.ok(serviceSource.includes('model: OPENAI_MODEL_ID'));
    assert.ok(serviceSource.includes('stream: false'));
    assert.ok(serviceSource.includes('Authorization: `Bearer ${apiKey}`'));
    assert.ok(serviceSource.includes('Artifacts must not send Authorization or API-key headers'));
  });

  await runTest('injectReboltOpenAIProxyRuntimeHelper prepends the runtime shim import', () => {
    const files = injectReboltOpenAIProxyRuntimeHelper(
      {
        '/src/App.tsx': `'use client';

export default function App() {
  return <div>Hello</div>;
}
`,
      },
      true,
    );

    assert.ok(files['/src/App.tsx']?.startsWith(`'use client';`));
    assert.ok(files['/src/App.tsx']?.includes(`import './rebolt-openai-proxy';`));
    assert.ok(files[REBOLT_OPENAI_PROXY_PATH]?.includes('installReboltOpenAIProxy'));
  });

  await runTest('buildReboltOpenAIProxyExportStub explains the export limitation clearly', () => {
    const stub = buildReboltOpenAIProxyExportStub();
    assert.ok(stub.includes(OPENAI_RESPONSES_API_URL));
    assert.ok(stub.includes('only works inside the Rebolt app'));
    assert.ok(stub.includes('your own backend integration'));
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
