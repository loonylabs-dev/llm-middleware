import { ThinkingExtractor, ThinkingExtractionResult } from '../thinking-extractor.interface';

/**
 * No-operation thinking extractor.
 * Returns content unchanged, with no thinking extracted.
 * Used for models that don't use thinking tags in their responses
 * or where thinking is already handled natively by the provider (e.g., Gemini, Anthropic).
 *
 * @since 2.18.0
 */
export class NoOpThinkingExtractor implements ThinkingExtractor {
  readonly name = 'noop';

  /**
   * Returns content unchanged.
   * @param content - Raw content from LLM response
   * @returns Original content with no thinking extracted
   */
  extract(content: string): ThinkingExtractionResult {
    return { content };
  }
}
