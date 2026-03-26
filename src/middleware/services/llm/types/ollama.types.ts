/**
 * Ollama-specific types and interfaces
 */

import { CommonLLMOptions, CommonLLMResponse, ReasoningEffort } from './common.types';

/**
 * Ollama-specific request options
 * Extends common options with Ollama-specific parameters
 */
export interface OllamaRequestOptions extends CommonLLMOptions {
  // Ollama-specific advanced parameters
  /** Optional: true = Thinking activate, false = deactivate (for Qwen 3.5+, DeepSeek etc) */
  think?: boolean;

  /** Optional: Override default axios timeout in ms */
  timeout?: number;

  /** Controls reasoning/thinking effort for models that support it (mapped to 'think') */
  reasoningEffort?: ReasoningEffort;

  /** Penalty for repeating tokens (default: 1.1) */
  repeat_penalty?: number;

  /** Top-p sampling (nucleus sampling) */
  top_p?: number;

  /** Top-k sampling */
  top_k?: number;

  /** Frequency penalty for token repetition */
  frequency_penalty?: number;

  /** Presence penalty for new topics */
  presence_penalty?: number;

  /** Number of previous tokens to consider for repeat penalty */
  repeat_last_n?: number;

  /** Maximum number of tokens to predict */
  num_predict?: number;

  /** Mirostat sampling (0 = disabled, 1 = Mirostat, 2 = Mirostat 2.0) */
  mirostat?: number;

  /** Mirostat learning rate */
  mirostat_eta?: number;

  /** Mirostat target entropy */
  mirostat_tau?: number;

  /** Tail-free sampling */
  tfs_z?: number;

  /** Typical sampling */
  typical_p?: number;

  /** Number of threads to use */
  num_thread?: number;
}

/**
 * Ollama-specific response format
 */
export interface OllamaResponse extends CommonLLMResponse {
  // Ollama-specific fields
  eval_count?: number;
  eval_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  total_duration?: number;
  load_duration?: number;
}

// Note: OllamaDebugInfo is now an alias for LLMDebugInfo
// Exported from debug-llm.utils.ts for backward compatibility
