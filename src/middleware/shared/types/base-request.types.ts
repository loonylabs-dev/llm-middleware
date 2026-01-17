import { Request } from 'express';
import { ClientInfo } from './client-info';
import { ReasoningEffort } from '../../services/llm/types';

/**
 * Extended Express Request interface with user and client info
 */
export interface RequestWithUser extends Request {
  user?: any;
  clientInfo: ClientInfo;
}

/**
 * Base interface for all AI use case requests
 * Generic type allows for different prompt types (string, complex objects, etc.)
 *
 * @since 2.17.0 - Added temperature and reasoningEffort for per-request control
 */
export interface BaseAIRequest<TPrompt = string> {
  prompt: TPrompt;
  authToken?: string;

  /**
   * Temperature for this specific request.
   * Overrides the model config temperature when provided.
   * Range: 0.0 (deterministic) to 2.0 (maximum randomness)
   *
   * @since 2.17.0
   */
  temperature?: number;

  /**
   * Reasoning/thinking effort for models that support it.
   * - 'none': Disable reasoning (where supported)
   * - 'low': Light reasoning, good for simple tasks
   * - 'medium': Balanced reasoning (often default)
   * - 'high': Deep reasoning for complex tasks
   *
   * @since 2.17.0
   */
  reasoningEffort?: ReasoningEffort;
}

/**
 * Base interface for all AI use case results
 */
export interface BaseAIResult {
  generatedContent: string;
  model: string;
  usedPrompt: string;
  thinking?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    /** Estimated cost in USD (calculated by consumer, legacy) */
    estimatedCostUsd?: number;
    /** Provider-reported cost in USD (from Requesty.AI) */
    costUsd?: number;
  };
}