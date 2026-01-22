import { ThinkingExtractor } from './thinking-extractor.interface';
import { NoOpThinkingExtractor, ThinkTagExtractor } from './extractors';

/**
 * Factory for creating and managing ThinkingExtractor instances.
 * Provides model-based heuristics and a registry for custom extractors.
 *
 * Built-in extractors:
 * - 'noop': NoOpThinkingExtractor - returns content unchanged
 * - 'think-tags': ThinkTagExtractor - extracts <think>, <thinking>, <reasoning> tags
 *
 * Model heuristics:
 * - DeepSeek models (deepseek-*, *-r1): ThinkTagExtractor
 * - QwQ models: ThinkTagExtractor
 * - Others: NoOpThinkingExtractor (provider handles thinking natively)
 *
 * @since 2.18.0
 */
export class ThinkingExtractorFactory {
  /** Registry of named extractors */
  private static extractors: Map<string, ThinkingExtractor> = new Map();

  /** Singleton instances for built-in extractors */
  private static noopInstance: NoOpThinkingExtractor;
  private static thinkTagInstance: ThinkTagExtractor;

  // Static initialization block
  static {
    // Create singleton instances
    this.noopInstance = new NoOpThinkingExtractor();
    this.thinkTagInstance = new ThinkTagExtractor();

    // Register built-in extractors
    this.register('noop', this.noopInstance);
    this.register('think-tags', this.thinkTagInstance);
  }

  /**
   * Register a custom extractor.
   * @param name - Unique name for the extractor
   * @param extractor - The extractor instance
   */
  static register(name: string, extractor: ThinkingExtractor): void {
    this.extractors.set(name, extractor);
  }

  /**
   * Get an extractor by name.
   * @param name - The registered name of the extractor
   * @returns The extractor instance, or NoOpThinkingExtractor if not found
   */
  static get(name: string): ThinkingExtractor {
    return this.extractors.get(name) || this.noopInstance;
  }

  /**
   * Get the appropriate extractor for a specific model.
   * Uses heuristics based on model name to determine which extractor to use.
   *
   * @param model - The model name (e.g., 'deepseek-r1:14b', 'qwq:32b')
   * @returns The appropriate ThinkingExtractor for the model
   *
   * @example
   * ```typescript
   * // DeepSeek R1 uses <think> tags
   * const extractor = ThinkingExtractorFactory.forModel('deepseek-r1:14b');
   * // Returns ThinkTagExtractor
   *
   * // Standard models don't use thinking tags
   * const extractor = ThinkingExtractorFactory.forModel('llama3:8b');
   * // Returns NoOpThinkingExtractor
   * ```
   */
  static forModel(model: string): ThinkingExtractor {
    const lowerModel = model.toLowerCase();

    // Models known to use <think> tags
    if (
      lowerModel.includes('deepseek') ||
      lowerModel.includes('-r1') ||
      lowerModel.includes('qwq')
    ) {
      return this.thinkTagInstance;
    }

    // Default: no extraction
    // For Gemini/Anthropic, thinking is handled natively in the provider
    return this.noopInstance;
  }

  /**
   * Check if a model is known to use thinking tags.
   * @param model - The model name
   * @returns true if the model uses thinking tags in its responses
   */
  static usesThinkingTags(model: string): boolean {
    const extractor = this.forModel(model);
    return extractor.name === 'think-tags';
  }
}
