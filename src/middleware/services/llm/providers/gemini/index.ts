/**
 * Gemini Provider Module
 * Exports all Gemini-based providers (Direct API and Vertex AI)
 */

// Base provider (abstract)
export {
  GeminiBaseProvider,
  GeminiProviderOptions,
  GeminiGeneration,
  detectGeminiGeneration,
  mapReasoningEffortToThinkingLevel,
  mapReasoningEffortToThinkingBudget
} from './gemini-base.provider';

// Direct API provider (API Key auth)
export {
  GeminiDirectProvider,
  geminiDirectProvider
} from './gemini-direct.provider';

// Vertex AI provider (Service Account auth)
export {
  VertexAIProvider,
  VertexAIProviderOptions,
  VertexAIRegion,
  vertexAIProvider
} from './vertex-ai.provider';
