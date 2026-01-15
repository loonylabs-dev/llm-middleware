/**
 * Google Gemini Provider (Backward Compatibility Re-export)
 *
 * This file re-exports the GeminiDirectProvider for backward compatibility.
 * New code should import from './gemini' directly.
 *
 * @deprecated Import from './gemini' instead for new code.
 */

// Re-export GeminiDirectProvider as GeminiProvider for backward compatibility
export { GeminiDirectProvider as GeminiProvider, geminiDirectProvider as geminiProvider } from './gemini';

// Also export the mapping function for backward compatibility
export { mapReasoningEffortToThinkingLevel as mapReasoningEffortToGemini } from './gemini';
