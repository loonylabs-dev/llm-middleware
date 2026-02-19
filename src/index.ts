// Main export file for the llm-middleware package
export * from './middleware';

// Explicit re-exports for bundler compatibility (Turbopack / Next.js 16+).
// These exports go through 7 levels of CJS __exportStar + Object.defineProperty
// getter chains in the compiled output, which Turbopack can't resolve.
// Direct re-exports create a single-level getter, bypassing the chain.
export {
  VertexAIProvider,
  type VertexAIProviderConfig,
  type VertexAIProviderOptions,
  type VertexAIRegion,
  vertexAIProvider,
} from './middleware/services/llm/providers/gemini/vertex-ai.provider';

export {
  GeminiDirectProvider,
  geminiDirectProvider,
} from './middleware/services/llm/providers/gemini/gemini-direct.provider';