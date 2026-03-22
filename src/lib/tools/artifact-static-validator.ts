import { OPENAI_RESPONSES_API_URL } from '../artifact/rebolt-openai-proxy-protocol';

const ARTIFACT_STATIC_VALIDATION_ERROR_MARKER = '[artifact-static-validation]';

const LOCALHOST_PATTERN = /\blocalhost\b|\b127\.0\.0\.1\b|\b0\.0\.0\.0\b/i;
const PRIVATE_IP_PATTERN =
  /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/;
const OTHER_PROVIDER_PATTERN =
  /\b(?:api\.anthropic\.com|openrouter\.ai|generativelanguage\.googleapis\.com|language\.googleapis\.com|api\.mistral\.ai)\b/i;
const OPENAI_RESPONSES_PATTERN = /\bhttps:\/\/api\.openai\.com\/v1\/responses\b/i;
const OPENAI_NON_RESPONSES_PATTERN = /\bapi\.openai\.com\/v1\/(?!responses\b)[A-Za-z0-9/_-]+\b/i;
const SERVER_ENV_PATTERN = /\b(?:process\.env|import\.meta\.env)\b/;
const SERVER_ONLY_IMPORT_PATTERN =
  /\b(?:import\s+['"]server-only['"]|from\s+['"]server-only['"]|from\s+['"]node:[^'"]+['"]|from\s+['"](?:fs|path|http|https|net|tls|child_process|worker_threads|os|crypto)['"]|require\(['"](?:fs|path|http|https|net|tls|child_process|worker_threads|os|crypto)['"]\))/;
const DIRECT_BACKEND_PATTERN =
  /\bfetch\s*\(\s*['"`](?:\/(?:api\/)?predict\b|\/api\/artifacts\/infer\b|\/api\/artifacts\/predict\b|\/api\/artifacts\/openai-proxy\b|\/api\/conversations\/[^'"`\s]+\/artifacts\/responses\b)/i;
const LEGACY_REBOLT_AI_IMPORT_PATTERN = /['"]\.\/rebolt-ai['"]/;
const LEGACY_REBOLT_PREDICT_IMPORT_PATTERN = /['"]\.\/rebolt-predict['"]/;
const LEGACY_REBOLT_AI_CALL_PATTERN = /\bcallReboltAI(?:Json|Text)?(?:<[^>]+>)?\s*\(/;
const AUTH_HEADER_OBJECT_PATTERN =
  /['"]?(?:authorization|x-api-key|api-key|openai-organization|openai-project)['"]?\s*:/i;
const AUTH_HEADER_MUTATION_PATTERN =
  /\b(?:set|append)\s*\(\s*['"](?:authorization|x-api-key|api-key|openai-organization|openai-project)['"]/i;
const HARDCODED_SECRET_PATTERN = /\b(?:sk-[A-Za-z0-9_-]{10,}|rk_(?:live|test)_[A-Za-z0-9_-]{10,})\b/;
const FAKE_MODEL_CLAIM_PATTERN =
  /\b(?:xgboost|random forest|mae\b|rmse\b|r\^?2\b|r²\b|tree-based regression|trained on the full dataset|trained model)\b/i;

interface LintArtifactFilesOptions {
  readonly useReboltAI: boolean;
}

function formatFailure(path: string, message: string): string {
  return `- ${path}: ${message}`;
}

export function isArtifactStaticValidationError(errorText: string): boolean {
  return errorText.includes(ARTIFACT_STATIC_VALIDATION_ERROR_MARKER);
}

export function stripArtifactStaticValidationError(errorText: string): string {
  return errorText.replace(ARTIFACT_STATIC_VALIDATION_ERROR_MARKER, '').trim();
}

export function lintArtifactFiles(files: Readonly<Record<string, string>>, options: LintArtifactFilesOptions): void {
  const failures: string[] = [];
  let sawOpenAIResponsesCall = false;

  for (const [path, content] of Object.entries(files)) {
    if (LOCALHOST_PATTERN.test(content)) {
      failures.push(
        formatFailure(path, 'Do not reference localhost or loopback addresses inside browser-only artifacts.'),
      );
    }

    if (PRIVATE_IP_PATTERN.test(content)) {
      failures.push(formatFailure(path, 'Do not reference private network IP addresses from generated artifacts.'));
    }

    if (OTHER_PROVIDER_PATTERN.test(content)) {
      failures.push(
        formatFailure(
          path,
          'Do not call non-OpenAI provider endpoints directly from the artifact. Only the Rebolt-proxied OpenAI Responses API is supported for secret-backed inference.',
        ),
      );
    }

    if (OPENAI_NON_RESPONSES_PATTERN.test(content)) {
      failures.push(
        formatFailure(
          path,
          `Only ${OPENAI_RESPONSES_API_URL} is supported for OpenAI-backed artifact inference. Do not call other OpenAI endpoints.`,
        ),
      );
    }

    if (OPENAI_RESPONSES_PATTERN.test(content)) {
      sawOpenAIResponsesCall = true;
      if (!options.useReboltAI) {
        failures.push(
          formatFailure(
            path,
            'This artifact calls the OpenAI Responses API but Rebolt AI is not enabled. Call generateArtifact with useReboltAI: true.',
          ),
        );
      }
    }

    if (SERVER_ENV_PATTERN.test(content)) {
      failures.push(formatFailure(path, 'Do not access process.env or import.meta.env from artifact code.'));
    }

    if (SERVER_ONLY_IMPORT_PATTERN.test(content)) {
      failures.push(formatFailure(path, 'Do not import server-only or Node.js modules in browser artifacts.'));
    }

    if (HARDCODED_SECRET_PATTERN.test(content)) {
      failures.push(formatFailure(path, 'Do not embed provider secrets or API keys in artifact code.'));
    }

    if (DIRECT_BACKEND_PATTERN.test(content)) {
      failures.push(
        formatFailure(
          path,
          `Do not fetch Rebolt backend routes directly from the artifact. Call ${OPENAI_RESPONSES_API_URL} and let the Rebolt runtime proxy it for you.`,
        ),
      );
    }

    if (AUTH_HEADER_OBJECT_PATTERN.test(content) || AUTH_HEADER_MUTATION_PATTERN.test(content)) {
      failures.push(
        formatFailure(
          path,
          'Artifacts must not send Authorization, API-key, organization, or project headers. Rebolt injects OpenAI auth server-side.',
        ),
      );
    }

    if (LEGACY_REBOLT_AI_IMPORT_PATTERN.test(content) || LEGACY_REBOLT_AI_CALL_PATTERN.test(content)) {
      failures.push(
        formatFailure(
          path,
          'New artifacts must call the OpenAI Responses API directly. Do not import or call "./rebolt-ai" from generated code.',
        ),
      );
    }

    if (LEGACY_REBOLT_PREDICT_IMPORT_PATTERN.test(content)) {
      failures.push(
        formatFailure(
          path,
          'The legacy "./rebolt-predict" helper has been removed. Generated artifacts must use direct OpenAI Responses API fetches or public browser-safe APIs.',
        ),
      );
    }

    if (options.useReboltAI && FAKE_MODEL_CLAIM_PATTERN.test(content)) {
      failures.push(
        formatFailure(
          path,
          'OpenAI-backed artifacts must stay truthful. Do not claim training metrics or specific ML algorithms that were not produced by the prompt or backend.',
        ),
      );
    }
  }

  if (options.useReboltAI && !sawOpenAIResponsesCall) {
    failures.push(`- The artifact requested live inference but does not call ${OPENAI_RESPONSES_API_URL}.`);
  }

  if (failures.length === 0) {
    return;
  }

  throw new Error(`${ARTIFACT_STATIC_VALIDATION_ERROR_MARKER}\n${failures.join('\n')}`);
}
