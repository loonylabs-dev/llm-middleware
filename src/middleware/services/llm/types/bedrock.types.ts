/**
 * AWS Bedrock-specific types and interfaces.
 *
 * Based on the Bedrock Converse API, which provides a model-agnostic message
 * format that works consistently across Claude, Nova, Llama, Mistral, Qwen, etc.
 * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
 *
 * Authentication uses a Bedrock API key as a Bearer token in the Authorization
 * header — no AWS SDK or SigV4 signing required. This keeps the provider aligned
 * with the existing axios-based providers (e.g. Anthropic, Vertex AI).
 */

import { CommonLLMOptions, CommonLLMResponse } from './common.types';

/**
 * Bedrock-specific request options.
 * Extends common options with Bedrock/Converse-specific parameters.
 */
export interface BedrockRequestOptions extends CommonLLMOptions {
  /**
   * AWS region for the bedrock-runtime endpoint (e.g. 'eu-central-1').
   * Falls back to BEDROCK_REGION env, then 'eu-central-1' (Frankfurt, EU residency).
   */
  region?: string;

  /** Nucleus sampling — maps to Converse inferenceConfig.topP (0.0 to 1.0) */
  topP?: number;

  /** Stop sequences — maps to Converse inferenceConfig.stopSequences */
  stopSequences?: string[];

  /** Request timeout in milliseconds (default: 180000) */
  timeout?: number;
}

/**
 * Request content block. Text-only for now; image blocks
 * ({ image: { format, source: { bytes } } }) are a planned follow-up.
 */
export interface BedrockContentBlock {
  text: string;
}

/** Converse message (request side) */
export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: BedrockContentBlock[];
}

/** Converse system prompt block — `system` is an array of these (top-level, not inside messages) */
export interface BedrockSystemBlock {
  text: string;
}

/** Converse inferenceConfig — standardized inference parameters across all models */
export interface BedrockInferenceConfig {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

/** Bedrock Converse API request payload */
export interface BedrockConverseRequest {
  messages: BedrockMessage[];
  /** Optional system prompt(s) */
  system?: BedrockSystemBlock[];
  /** Standardized inference parameters */
  inferenceConfig?: BedrockInferenceConfig;
  /**
   * Model-specific parameters that the Converse API does not standardize
   * (escape hatch, e.g. for per-model reasoning toggles).
   */
  additionalModelRequestFields?: Record<string, unknown>;
}

/**
 * Reasoning content emitted by reasoning-capable models (e.g. Qwen3, Claude
 * extended thinking) within a response content block.
 */
export interface BedrockReasoningContent {
  reasoningText?: {
    text: string;
    signature?: string;
  };
}

/**
 * Response content block — carries either generated `text` or `reasoningContent`.
 * A single response message may contain multiple blocks of different kinds.
 */
export interface BedrockResponseContentBlock {
  text?: string;
  reasoningContent?: BedrockReasoningContent;
}

/** Converse token usage. cache* fields appear when prompt caching is active. */
export interface BedrockUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
}

/** Bedrock Converse API response payload */
export interface BedrockConverseResponse {
  output: {
    message: {
      role: 'assistant';
      content: BedrockResponseContentBlock[];
    };
  };
  /** e.g. 'end_turn', 'max_tokens', 'stop_sequence' */
  stopReason: string;
  usage: BedrockUsage;
  metrics?: {
    latencyMs: number;
  };
}

/**
 * Bedrock-specific response (normalized to CommonLLMResponse).
 * Keeps the raw stopReason for consumers that need it.
 */
export interface BedrockResponse extends CommonLLMResponse {
  stopReason?: string;
}
