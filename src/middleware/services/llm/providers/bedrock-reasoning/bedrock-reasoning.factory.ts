import { BedrockReasoningStrategy } from './bedrock-reasoning.types';
import { ReasoningEffortStrategy } from './reasoning-effort.strategy';
import { NovaReasoningStrategy } from './nova-reasoning.strategy';
import { NoOpReasoningStrategy } from './noop-reasoning.strategy';

/**
 * Selects the {@link BedrockReasoningStrategy} for a given Bedrock model id.
 *
 * Mapping (by model-id substring):
 * - `nova`                  → reasoningConfig (Amazon Nova 2)
 * - `minimax`               → no-op (always-on interleaved thinking, no toggle)
 * - `anthropic` / `claude`  → no-op (uses `thinking` budget, not reasoning_effort — follow-up)
 * - everything else         → reasoning_effort (Qwen, Kimi, gpt-oss, GLM, DeepSeek, …)
 *
 * `reasoning_effort` is the default because it is supported by every open-weight
 * model verified on Bedrock Converse, which keeps behavior uniform "regardless of model".
 */
export class BedrockReasoningFactory {
  private static readonly reasoningEffort = new ReasoningEffortStrategy();
  private static readonly nova = new NovaReasoningStrategy();
  private static readonly minimax = new NoOpReasoningStrategy(
    'MiniMax uses always-on interleaved thinking with no Converse toggle',
    'noop-minimax'
  );
  private static readonly claude = new NoOpReasoningStrategy(
    "Claude on Bedrock uses a 'thinking' token budget, not reasoning_effort (mapping is a planned follow-up)",
    'noop-claude'
  );

  static forModel(model: string): BedrockReasoningStrategy {
    const m = model.toLowerCase();
    if (m.includes('nova')) return this.nova;
    if (m.includes('minimax')) return this.minimax;
    if (m.includes('anthropic') || m.includes('claude')) return this.claude;
    return this.reasoningEffort;
  }
}
