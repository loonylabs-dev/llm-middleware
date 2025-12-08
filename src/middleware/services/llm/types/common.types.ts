/**
 * Common types shared across all LLM providers
 */

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

  /** Session ID for conversation continuity */
  sessionId?: string;

  /** Chapter number (for book generation use cases) */
  chapterNumber?: number;

  /** Page number (for book generation use cases) */
  pageNumber?: number;

  /** Page name (for book generation use cases) */
  pageName?: string;

  /** Provider-specific options (escape hatch) */
  providerSpecific?: Record<string, any>;
}

/**
 * Provider-agnostic token usage information
 * Normalized across all LLM providers (Anthropic, Ollama, OpenAI, Google)
 */
export interface TokenUsage {
  /** Number of tokens in the input/prompt */
  inputTokens: number;
  /** Number of tokens in the output/completion */
  outputTokens: number;
  /** Total tokens (inputTokens + outputTokens) */
  totalTokens: number;
  /** Cost of the request in EUR (optional, provider-specific) */
  cost?: number;
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
  REQUESTY = 'requesty'
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
}
