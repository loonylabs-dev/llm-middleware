import { ReasoningEffort } from '../../types';
import { BedrockReasoningStrategy, BedrockReasoningApplication } from './bedrock-reasoning.types';

/**
 * Reasoning strategy for models that accept the OpenAI-style `reasoning_effort`
 * (low/medium/high) via `additionalModelRequestFields` on the Bedrock Converse API.
 *
 * Verified live (all return native reasoningContent): Qwen3, Kimi K2.5,
 * gpt-oss-120b/20b, GLM-5, GLM-4.7, DeepSeek V3.2. This is the de-facto standard
 * for open-weight models on Bedrock, so it also serves as the default strategy.
 */
export class ReasoningEffortStrategy implements BedrockReasoningStrategy {
  readonly name = 'reasoning_effort';

  apply(effort: ReasoningEffort): BedrockReasoningApplication {
    if (effort === 'none') {
      // These models reason by default and expose no reliable "off" switch via
      // Converse (thinking:{type:disabled} is ignored). We omit the field so the
      // model uses its default, and warn that reasoning likely stays on.
      return {
        warnings: [
          "reasoningEffort 'none' has no reliable effect on reasoning_effort models " +
          '(Qwen/Kimi/gpt-oss/GLM/DeepSeek); reasoning may remain enabled.'
        ]
      };
    }
    return { additionalModelRequestFields: { reasoning_effort: effort } };
  }
}
