/**
 * Result of thinking extraction from LLM response content.
 */
export interface ThinkingExtractionResult {
  /** Content with thinking removed */
  content: string;
  /** Extracted thinking text (undefined if none found) */
  thinking?: string;
}

/**
 * Strategy interface for extracting thinking/reasoning from LLM responses.
 * Different models use different mechanisms to expose their reasoning:
 * - DeepSeek R1: <think> tags in content
 * - Some models: <thinking> or <reasoning> tags
 * - Gemini: thought:true parts in API response (handled natively in provider)
 * - Anthropic: Extended Thinking API (handled natively in provider)
 *
 * @since 2.18.0
 */
export interface ThinkingExtractor {
  /**
   * Extract thinking from content.
   * @param content - Raw content from LLM response
   * @returns Content with thinking separated
   */
  extract(content: string): ThinkingExtractionResult;

  /**
   * Human-readable name for logging/debugging.
   */
  readonly name: string;
}
