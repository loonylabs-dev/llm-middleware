/**
 * Azure OpenAI / Microsoft Foundry-specific types and interfaces.
 *
 * Azure exposes OpenAI (and some partner) models through an OpenAI-compatible
 * Chat Completions API. This provider targets the new **v1 route**
 * (`{endpoint}/openai/v1/chat/completions`), where the deployment name is sent
 * as the `model` field in the request body and `api-version` is optional.
 *
 * Authentication uses an Azure API key in the **`api-key` header** (not
 * `Authorization: Bearer`, which Azure reserves for Microsoft Entra ID tokens).
 *
 * Reasoning models (o-series, GPT-5 series) and standard models (gpt-4o, …) take
 * a different parameter set; see `providers/azure-openai-capabilities.ts`.
 *
 * @see https://learn.microsoft.com/en-us/azure/foundry/openai/latest
 */

import { CommonLLMOptions, CommonLLMResponse } from './common.types';

/**
 * Azure-specific request options.
 * Extends common options with Azure/Foundry-specific parameters.
 */
export interface AzureOpenAIRequestOptions extends CommonLLMOptions {
  /**
   * Resource endpoint base URL, e.g. `https://<resource>.openai.azure.com` or
   * `https://<resource>.services.ai.azure.com`. The region is encoded in the host.
   * Falls back to `baseUrl`, then the AZURE_OPENAI_ENDPOINT env var.
   */
  endpoint?: string;

  /**
   * Deployment name — sent as the `model` field in the request body.
   * Falls back to the common `model` option, then the AZURE_OPENAI_DEPLOYMENT env var.
   */
  deployment?: string;

  /**
   * Optional `api-version` query parameter. Leave empty for the v1 GA route.
   * Falls back to the AZURE_OPENAI_API_VERSION env var.
   */
  apiVersion?: string;

  /** Nucleus sampling — standard models only; ignored for reasoning models. */
  topP?: number;

  /**
   * Explicit override for reasoning-model parameter handling. Azure deployment
   * names are user-chosen, so the name heuristic can miss a renamed reasoning
   * model — set this to force the correct behavior.
   * - `true`  → treat as a reasoning model (max_completion_tokens, no temperature, reasoning_effort)
   * - `false` → treat as a standard model (max_tokens, temperature)
   */
  reasoningModel?: boolean;

  /** Request timeout in milliseconds (default: 180000). */
  timeout?: number;
}

/**
 * Reasoning effort values accepted by Azure reasoning models.
 * `minimal`/`xhigh`/`none` are only supported by specific model generations.
 */
export type AzureOpenAIReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/** OpenAI-compatible content part for multimodal (vision) messages. */
export type AzureOpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

/** OpenAI-compatible chat message. `developer` is the reasoning-model equivalent of `system`. */
export interface AzureOpenAIMessage {
  role: 'system' | 'developer' | 'user' | 'assistant';
  content: string | AzureOpenAIContentPart[];
}

/**
 * Azure OpenAI Chat Completions request payload (OpenAI-compatible).
 * `max_tokens` vs `max_completion_tokens` and `temperature` vs `reasoning_effort`
 * are mutually exclusive per model class — the provider sets only the valid set.
 */
export interface AzureOpenAIRequest {
  /** Deployment name */
  model: string;
  messages: AzureOpenAIMessage[];
  /** Standard models only. Reasoning models reject this (HTTP 400). */
  max_tokens?: number;
  /** Reasoning models only (replaces max_tokens). */
  max_completion_tokens?: number;
  /** Standard models only. Reasoning models reject this (HTTP 400). */
  temperature?: number;
  /** Standard models only. */
  top_p?: number;
  /** Reasoning models only. */
  reasoning_effort?: AzureOpenAIReasoningEffort;
}

/** Azure Chat Completions token usage (OpenAI-compatible, with Azure detail blocks). */
export interface AzureOpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /** Reasoning-model detail; `reasoning_tokens` is a subset of `completion_tokens`. */
  completion_tokens_details?: {
    reasoning_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
    audio_tokens?: number;
  };
  /** `cached_tokens` reflects prompt-cache hits. */
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
  };
}

/** Azure OpenAI Chat Completions API response payload. */
export interface AzureOpenAIAPIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage: AzureOpenAIUsage;
}

/**
 * Azure OpenAI-specific response (normalized to CommonLLMResponse).
 * Keeps the raw id/finish_reason for consumers that need them.
 */
export interface AzureOpenAIResponse extends CommonLLMResponse {
  id?: string;
  finish_reason?: string;
}
