/**
 * Anthropic-specific types and interfaces
 * Based on Anthropic Messages API: https://docs.anthropic.com/en/api/messages
 */

import { CommonLLMOptions, CommonLLMResponse, ReasoningEffort } from './common.types';

/**
 * Anthropic Extended Thinking configuration.
 * Enables the model to show its reasoning process.
 * @see https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
 */
export interface AnthropicThinkingConfig {
  /** Type must be 'enabled' to activate extended thinking */
  type: 'enabled';
  /** Token budget for thinking (minimum 1024, must be less than max_tokens) */
  budget_tokens: number;
}

/**
 * Anthropic-specific request options
 * Extends common options with Anthropic-specific parameters
 */
export interface AnthropicRequestOptions extends CommonLLMOptions {
  // Anthropic-specific parameters

  /** Top-p sampling (nucleus sampling) - Range: 0.0 to 1.0 */
  top_p?: number;

  /** Top-k sampling - Only sample from top K options */
  top_k?: number;

  /** Custom text sequences that will cause the model to stop generating */
  stop_sequences?: string[];

  /** Whether to stream the response */
  stream?: boolean;

  /** System message to set context (Anthropic puts this at root level) */
  system?: string;
}

/**
 * Anthropic message format
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Anthropic API request payload
 */
export interface AnthropicAPIRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  system?: string;
  /** Extended thinking configuration for models that support it (Claude 3.5+) */
  thinking?: AnthropicThinkingConfig;
}

/**
 * Anthropic content block (response can have multiple blocks)
 */
export interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

/**
 * Anthropic usage information
 * Based on: https://docs.anthropic.com/en/api/messages
 */
export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  /** Tokens used to create ephemeral cache (if prompt caching enabled) */
  cache_creation_input_tokens?: number;
  /** Tokens read from cache (if prompt caching enabled) */
  cache_read_input_tokens?: number;
}

/**
 * Anthropic API response format
 */
export interface AnthropicAPIResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence?: string | null;
  usage: AnthropicUsage;
}

/**
 * Anthropic-specific response format (normalized to CommonLLMResponse)
 */
export interface AnthropicResponse extends CommonLLMResponse {
  // Anthropic-specific fields
  id?: string;
  stop_reason?: string;
  input_tokens?: number;
  output_tokens?: number;
}
