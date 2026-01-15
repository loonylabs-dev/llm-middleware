/**
 * Google Gemini-specific types and interfaces
 * Based on Google Gemini API: https://ai.google.dev/api/rest
 */

import { CommonLLMOptions, CommonLLMResponse, ReasoningEffort } from './common.types';

/**
 * Gemini thinking level for models with reasoning capabilities (Gemini 3 Flash, etc.)
 * Maps to the thinking_level parameter in Gemini API.
 */
export type GeminiThinkingLevel = 'THINKING_LEVEL_UNSPECIFIED' | 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Gemini thinking configuration for reasoning models.
 * - Gemini 3.x: Uses thinkingLevel (MINIMAL/LOW/MEDIUM/HIGH)
 * - Gemini 2.5: Uses thinkingBudget (integer 0-24576)
 *
 * Note: Cannot use both thinkingLevel and thinkingBudget in the same request.
 */
export interface GeminiThinkingConfig {
  /**
   * Thinking level for Gemini 3.x models.
   * - MINIMAL: Minimum thinking (Gemini 3 Flash only)
   * - LOW: Light reasoning for simple tasks
   * - MEDIUM: Balanced reasoning (Gemini 3 Flash only)
   * - HIGH: Deep reasoning (default for complex tasks)
   */
  thinkingLevel?: GeminiThinkingLevel;

  /**
   * Thinking token budget for Gemini 2.5 models.
   * - 0: Disable thinking
   * - -1: Dynamic (let model decide)
   * - 1-24576: Fixed token budget
   */
  thinkingBudget?: number;

  /**
   * If true, includes the model's thoughts in the response.
   * Required for Vertex AI v1beta1 to return thoughtsTokenCount.
   */
  includeThoughts?: boolean;
}

/**
 * Gemini-specific request options
 * Extends common options with Gemini-specific parameters
 */
export interface GeminiRequestOptions extends CommonLLMOptions {
  // Gemini-specific parameters

  /** Top-p sampling (nucleus sampling) - Range: 0.0 to 1.0 */
  topP?: number;

  /** Top-k sampling - Only sample from top K options */
  topK?: number;

  /** Stop sequences that will cause the model to stop generating */
  stopSequences?: string[];

  /** Candidate count - number of response variations to generate */
  candidateCount?: number;

  /** Maximum number of tokens to generate (Gemini uses maxOutputTokens) */
  maxOutputTokens?: number;
}

/**
 * Gemini content part (text or other types)
 */
export interface GeminiPart {
  text: string;
}

/**
 * Gemini message content
 */
export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/**
 * Gemini generation configuration
 */
export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  /** Thinking configuration for reasoning models (Gemini 3 Flash, etc.) */
  thinkingConfig?: GeminiThinkingConfig;
}

/**
 * Gemini safety settings
 */
export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

/**
 * Gemini API request payload
 */
export interface GeminiAPIRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySetting[];
  systemInstruction?: {
    parts: GeminiPart[];
  };
}

/**
 * Gemini candidate response
 */
export interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: string;
  index: number;
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
}

/**
 * Gemini usage metadata
 */
export interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  /** Reasoning/thinking tokens for Gemini 3+ models with thinking enabled */
  thoughtsTokenCount?: number;
}

/**
 * Gemini API response format
 */
export interface GeminiAPIResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  promptFeedback?: {
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  };
}

/**
 * Gemini-specific response format (normalized to CommonLLMResponse)
 */
export interface GeminiResponse extends CommonLLMResponse {
  // Gemini-specific fields
  finishReason?: string;
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
}
