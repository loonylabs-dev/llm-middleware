import { ReasoningEffort } from '../../types';
import { BedrockReasoningStrategy, BedrockReasoningApplication } from './bedrock-reasoning.types';

/**
 * Reasoning strategy for Amazon Nova 2 models.
 *
 * Uses `reasoningConfig` { type, maxReasoningEffort } via additionalModelRequestFields.
 * At maxReasoningEffort='high', Nova forbids temperature/topP/maxTokens — the provider
 * removes them (and warns) per the configured auto-removal behavior.
 *
 * @see https://docs.aws.amazon.com/nova/latest/nova2-userguide/extended-thinking.html
 */
export class NovaReasoningStrategy implements BedrockReasoningStrategy {
  readonly name = 'nova-reasoningConfig';

  apply(effort: ReasoningEffort): BedrockReasoningApplication {
    if (effort === 'none') {
      return {
        additionalModelRequestFields: { reasoningConfig: { type: 'disabled' } }
      };
    }

    const app: BedrockReasoningApplication = {
      additionalModelRequestFields: {
        reasoningConfig: { type: 'enabled', maxReasoningEffort: effort }
      }
    };

    if (effort === 'high') {
      // Nova rejects these inference parameters when maxReasoningEffort='high'.
      app.removeInferenceConfigKeys = ['temperature', 'topP', 'maxTokens'];
      app.warnings = [
        "Nova at reasoningEffort 'high' forbids temperature/topP/maxTokens; " +
        'these were removed from inferenceConfig.'
      ];
    }

    return app;
  }
}
