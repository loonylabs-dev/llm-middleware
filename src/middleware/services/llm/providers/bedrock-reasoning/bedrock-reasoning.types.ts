/**
 * Reasoning strategy abstraction for the AWS Bedrock provider.
 *
 * Bedrock has no unified reasoning parameter across model families:
 * - Most open-weight models (Kimi, gpt-oss, GLM, DeepSeek) accept the
 *   OpenAI-style `reasoning_effort` (low/medium/high) → verified live.
 * - Amazon Nova uses `reasoningConfig` ({ type, maxReasoningEffort }) and forbids
 *   some inference parameters at maxReasoningEffort=high.
 * - Qwen toggles thinking via a prompt suffix (`/no_think`).
 * - Some models (MiniMax) have no reasoning control at all.
 *
 * This Strategy Pattern (mirroring the ThinkingExtractor pattern) hides that
 * heterogeneity: the consumer always sets the provider-agnostic `reasoningEffort`,
 * and the provider applies the right mechanism per model.
 */

import { ReasoningEffort } from '../../types';
import { BedrockInferenceConfig } from '../../types/bedrock.types';

/**
 * The set of request modifications a strategy produces for a given effort.
 * The provider merges these into the outgoing Converse request.
 */
export interface BedrockReasoningApplication {
  /**
   * Fields to merge into the request's `additionalModelRequestFields`
   * (model-specific reasoning toggles, e.g. `{ reasoning_effort: 'high' }`).
   */
  additionalModelRequestFields?: Record<string, unknown>;

  /**
   * `inferenceConfig` keys the model forbids while reasoning is active and that
   * the provider must remove (e.g. Nova at maxReasoningEffort=high forbids
   * temperature/topP/maxTokens). The provider removes them and logs a warning.
   */
  removeInferenceConfigKeys?: (keyof BedrockInferenceConfig)[];

  /** Text appended to the user prompt (e.g. Qwen `/no_think` to disable thinking). */
  promptSuffix?: string;

  /** Human-readable warnings the provider should surface via the logger. */
  warnings?: string[];
}

/**
 * Maps the provider-agnostic {@link ReasoningEffort} to a specific model family's
 * reasoning mechanism on the Bedrock Converse API.
 */
export interface BedrockReasoningStrategy {
  /** Strategy name, used for logging/debugging. */
  readonly name: string;

  /**
   * Produces the request modifications for the requested effort.
   * Only called when `reasoningEffort` is defined; when it is undefined the
   * provider leaves reasoning untouched (each model uses its own default).
   */
  apply(effort: ReasoningEffort): BedrockReasoningApplication;
}
