/**
 * Common types shared across all LLM providers
 */

import type { RetryConfig } from '../utils/retry.utils';

/**
 * Reasoning effort levels for models with thinking/reasoning capabilities.
 * Maps to provider-specific parameters:
 * - Gemini: thinking_level (LOW, MEDIUM, HIGH)
 * - OpenAI o1/o3: reasoning_effort (low, medium, high)
 * - Anthropic: budget_tokens (1024, 8192, 16384)
 *
 * Use 'none' to disable reasoning where supported (e.g., Gemini 2.5+ via OpenAI-compatible API).
 */
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

/**
 * Common request options that work across all LLM providers
 */
export interface CommonLLMOptions {
  /** The model to use (provider-specific model name) */
  model?: string;

  /** Controls randomness: 0 = deterministic, 1 = maximum randomness */
  temperature?: number;

  /** Maximum number of tokens to generate */
  maxTokens?: number;

  /** Base URL for the API endpoint */
  baseUrl?: string;

  /** Authentication token (if required) */
  authToken?: string;

  /** Debug context for logging */
  debugContext?: string;

  /** Region for Vertex AI (e.g., 'europe-west1'). Ignored by other providers. */
  region?: string;

  /** Session ID for conversation continuity */
  sessionId?: string;

  /** Chapter number (for book generation use cases) */
  chapterNumber?: number;

  /** Page number (for book generation use cases) */
  pageNumber?: number;

  /** Page name (for book generation use cases) */
  pageName?: string;

  /**
   * Controls reasoning/thinking effort for models that support it.
   * - 'none': Disable reasoning (where supported)
   * - 'low': Light reasoning, good for simple tasks
   * - 'medium': Balanced reasoning (often default)
   * - 'high': Deep reasoning for complex tasks
   *
   * @see ReasoningEffort for provider-specific mappings
   */
  reasoningEffort?: ReasoningEffort;

  /** Provider-specific options (escape hatch) */
  providerSpecific?: Record<string, any>;

  /**
   * Retry configuration for transient HTTP errors (429, 5xx, timeouts).
   * Default: enabled with exponential backoff (1s initial, 2x multiplier, 30s max, 3 retries).
   * Set `{ enabled: false }` to disable.
   */
  retry?: RetryConfig;
}

export type { RetryConfig };

/**
 * Provider-agnostic token usage information
 * Normalized across all LLM providers (Anthropic, Ollama, OpenAI, Google)
 */
export interface TokenUsage {
  /** Number of tokens in the input/prompt */
  inputTokens: number;
  /** Number of tokens in the output/completion */
  outputTokens: number;
  /** Total tokens (inputTokens + outputTokens + reasoningTokens) */
  totalTokens: number;
  /** Reasoning/thinking tokens (Gemini thoughtsTokenCount, OpenAI reasoning_tokens, etc.) */
  reasoningTokens?: number;
  /** Cost of the request in USD (optional, provider-specific, from Requesty.AI) */
  costUsd?: number;
  /** Cache-related token counts (optional, provider-specific) */
  cacheMetadata?: {
    /** Tokens used to create cache */
    cacheCreationTokens?: number;
    /** Tokens read from cache */
    cacheReadTokens?: number;
  };
}

/**
 * Common response format across all providers
 */
export interface CommonLLMResponse {
  message: {
    content: string;
    /** Optional thinking/reasoning text from models that support it (e.g., Gemini with includeThoughts: true) */
    thinking?: string;
  };
  sessionId?: string;
  metadata?: {
    provider: string;
    model: string;
    tokensUsed?: number;
    processingTime?: number;
  };
  /**
   * Standardized token usage information
   * Available when the provider returns actual token counts
   * If not available, tokens will be estimated in metrics calculation
   */
  usage?: TokenUsage;
}

/**
 * Supported LLM providers
 */
export enum LLMProvider {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  REQUESTY = 'requesty',
  /** Google Vertex AI - Service Account auth, EU hosting support */
  VERTEX_AI = 'vertex_ai'
}

/**
 * Debug information interface (provider-agnostic)
 */
export interface LLMDebugInfo {
  timestamp: Date;
  provider: string;
  model: string;
  baseUrl: string;
  systemMessage: string;
  userMessage: string;
  requestData: any;

  // Optional response fields
  response?: string;
  thinking?: string;
  responseTimestamp?: Date;
  rawResponseData?: any;
  error?: {
    message: string;
    details?: any;
  };

  // Use case context
  useCase?: string;
  clientRequestBody?: any;
  sessionId: string;

  // Chapter and page context for book generation
  chapterNumber?: number;
  pageNumber?: number;
  pageName?: string;

  // Request parameters for logging (since 2.17.0)
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
}
