// NEW FILE: requesty.types.ts
import { CommonLLMOptions, CommonLLMResponse } from './common.types';

/**
 * Requesty-specific request options
 * Extends common options with Requesty-specific fields
 */
export interface RequestyRequestOptions extends CommonLLMOptions {
  httpReferer?: string;  // Optional: Analytics - your site URL
  xTitle?: string;       // Optional: Analytics - your app name
}

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
  };
}

/**
 * Normalized Requesty response (extends CommonLLMResponse)
 */
export interface RequestyResponse extends CommonLLMResponse {
  id?: string;
  finish_reason?: string;
}
