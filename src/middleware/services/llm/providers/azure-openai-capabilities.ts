/**
 * Azure OpenAI model-capability detection.
 *
 * On Azure, reasoning models (o-series, GPT-5 series) and standard models
 * (gpt-4o, gpt-4o-mini, …) require a *different* parameter set — verified live:
 * - Reasoning models use `max_completion_tokens` and REJECT `temperature`/`max_tokens` (HTTP 400);
 *   they accept `reasoning_effort`.
 * - Standard models use `max_tokens` + `temperature` and ignore `reasoning_effort`.
 *
 * The split is binary, so a lightweight helper (rather than a full strategy
 * pattern) is sufficient. Because Azure deployment names are user-chosen, the
 * name heuristic can be overridden explicitly via `AzureOpenAIRequestOptions.reasoningModel`.
 */

import { ReasoningEffort } from '../types';
import { AzureOpenAIReasoningEffort } from '../types/azure-openai.types';

/**
 * Deployment-name patterns that indicate a reasoning model. Matched against the
 * deployment name (which usually defaults to the underlying model name).
 * - `o\d` family: o1, o1-mini, o3, o3-mini, o3-pro, o4-mini (separator-anchored to avoid e.g. "neo4j")
 * - GPT-5 series: gpt-5, gpt-5-mini, gpt-5.1, gpt5, gpt-5-codex
 * - codex-mini
 */
const REASONING_NAME_PATTERNS: RegExp[] = [
  /(^|[-_/.])o\d+(-(mini|pro|preview))?($|[-_/.])/i,
  /gpt-?5/i,
  /(^|[-_/.])codex(-mini)?($|[-_/.])/i,
];

/**
 * Decide whether a deployment should be treated as a reasoning model.
 * @param deployment - The Azure deployment name (sent as `model`).
 * @param override - Explicit override; when a boolean, it wins over the heuristic.
 */
export function isAzureReasoningModel(deployment: string, override?: boolean): boolean {
  if (typeof override === 'boolean') return override;
  if (!deployment) return false;
  return REASONING_NAME_PATTERNS.some(re => re.test(deployment));
}

/**
 * Map the provider-agnostic {@link ReasoningEffort} to Azure's `reasoning_effort`.
 *
 * Returns `{ value }` to send, or `{ warning }` (and no value) when the effort
 * should be omitted. `none` is intentionally omitted: only gpt-5.1+ accept it,
 * while o-series reject it — omitting lets the model use its default safely.
 */
export function mapAzureReasoningEffort(
  effort: ReasoningEffort
): { value?: AzureOpenAIReasoningEffort; warning?: string } {
  switch (effort) {
    case 'low':
    case 'medium':
    case 'high':
      return { value: effort };
    case 'none':
      return {
        warning:
          "reasoningEffort 'none' is not reliably supported across Azure reasoning models " +
          '(only gpt-5.1+ accept it; o-series reject it). Omitting reasoning_effort so the ' +
          'model uses its default.',
      };
    default:
      // Defensive: unknown value → safe middle ground.
      return { value: 'medium' };
  }
}
