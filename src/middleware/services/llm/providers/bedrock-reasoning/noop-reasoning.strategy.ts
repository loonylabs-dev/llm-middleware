import { ReasoningEffort } from '../../types';
import { BedrockReasoningStrategy, BedrockReasoningApplication } from './bedrock-reasoning.types';

/**
 * No-op reasoning strategy for models without configurable reasoning on Converse.
 *
 * Used for MiniMax (always-on "interleaved thinking", no toggle) and for model
 * families whose reasoning is not yet mapped (e.g. Anthropic Claude, which uses a
 * `thinking` token budget instead of `reasoning_effort`). Emits a warning so the
 * consumer knows the requested effort had no effect.
 */
export class NoOpReasoningStrategy implements BedrockReasoningStrategy {
  readonly name: string;

  constructor(private readonly reason: string, name = 'noop') {
    this.name = name;
  }

  apply(effort: ReasoningEffort): BedrockReasoningApplication {
    return {
      warnings: [`reasoningEffort '${effort}' is not applied: ${this.reason}`]
    };
  }
}
