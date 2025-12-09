import { Request } from 'express';
import { ClientInfo } from './client-info';

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
 */
export interface BaseAIRequest<TPrompt = string> {
  prompt: TPrompt;
  authToken?: string;
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