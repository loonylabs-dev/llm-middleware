import { ThinkingExtractor, ThinkingExtractionResult } from '../thinking-extractor.interface';

/**
 * Thinking extractor for models that use XML-style tags in their responses.
 * Supports multiple tag formats:
 * - <think>...</think> (DeepSeek R1, commonly used)
 * - <thinking>...</thinking> (alternative format)
 * - <reasoning>...</reasoning> (alternative format)
 *
 * All tags are case-insensitive and support multiline content.
 *
 * @since 2.18.0
 */
export class ThinkTagExtractor implements ThinkingExtractor {
  readonly name = 'think-tags';

  /**
   * Regex patterns for supported thinking tags.
   * Order matters: more specific patterns should come first.
   */
  private readonly patterns: RegExp[] = [
    /<thinking>([\s\S]*?)<\/thinking>/gi,
    /<reasoning>([\s\S]*?)<\/reasoning>/gi,
    /<think>([\s\S]*?)<\/think>/gi,
  ];

  /**
   * Extract thinking from content using tag patterns.
   * @param content - Raw content from LLM response
   * @returns Content with thinking tags removed and thinking text extracted
   */
  extract(content: string): ThinkingExtractionResult {
    let thinkingParts: string[] = [];
    let cleanContent = content;

    // Process each pattern
    for (const pattern of this.patterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;

      // Find all matches for this pattern
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const extractedThinking = match[1]?.trim();
        if (extractedThinking) {
          thinkingParts.push(extractedThinking);
        }
        // Remove the matched tag from clean content
        cleanContent = cleanContent.replace(match[0], '');
      }
    }

    // Clean up whitespace in content
    cleanContent = cleanContent.trim();

    // Join all thinking parts with double newlines
    const thinking = thinkingParts.length > 0
      ? thinkingParts.join('\n\n')
      : undefined;

    return {
      content: cleanContent,
      thinking
    };
  }
}
