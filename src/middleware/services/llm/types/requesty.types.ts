// NEW FILE: requesty.types.ts
import { CommonLLMOptions, CommonLLMResponse, ReasoningEffort } from './common.types';

/**
 * Requesty-specific request options
 * Extends common options with Requesty-specific fields
 */
export interface RequestyRequestOptions extends CommonLLMOptions {
  httpReferer?: string;  // Optional: Analytics - your site URL
  xTitle?: string;       // Optional: Analytics - your app name
}

/**
 * Requesty reasoning effort values.
 * Used for models like OpenAI o1/o3, Gemini with thinking, etc.
 *
 * Note: Google Gemini doesn't support 'none' - use 'min' instead.
 * Requesty accepts both standard ('low', 'medium', 'high') and
 * extended values ('min', 'max', 'none').
 */
export type RequestyReasoningEffort = 'none' | 'min' | 'low' | 'medium' | 'high' | 'max';

/**
 * OpenAI-compatible request format for Requesty API
 */
export interface RequestyAPIRequest {
  model: string;  // Format: provider/model-name (e.g., "openai/gpt-4o")
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  /**
   * Reasoning effort for models that support it (OpenAI o1/o3, Gemini with thinking).
   * - 'none': Disable reasoning (OpenAI only - Gemini uses 'min')
   * - 'min': Minimal reasoning (Gemini - maps to MINIMAL thinking level)
   * - 'low': Light reasoning, faster responses
   * - 'medium': Balanced (default for most reasoning models)
   * - 'high': Deep reasoning for complex tasks
   * - 'max': Maximum reasoning (where supported)
   */
  reasoning_effort?: RequestyReasoningEffort;
}

/**
 * OpenAI-compatible response format from Requesty API
 */
export interface RequestyAPIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
}

/**
 * Normalized Requesty response (extends CommonLLMResponse)
 */
export interface RequestyResponse extends CommonLLMResponse {
  id?: string;
  finish_reason?: string;
}
