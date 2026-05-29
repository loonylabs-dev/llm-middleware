// NEW FILE: inceptron.types.ts
import { CommonLLMOptions, CommonLLMResponse, ReasoningEffort } from './common.types';

/**
 * Inceptron-specific request options.
 *
 * Inceptron (Inceptron AB, Lund/Sweden) serves curated open-weight models
 * (GLM-5.1, Kimi, DeepSeek, gpt-oss, …) via an OpenAI-compatible Chat
 * Completions API. The wire format matches the Requesty provider; the only
 * Inceptron-specific behaviours are documented on the response type below.
 *
 * Auth, endpoint and model fall back to the common options, then to the
 * INCEPTRON_API_KEY / INCEPTRON_BASE_URL / INCEPTRON_MODEL env vars.
 */
export interface InceptronRequestOptions extends CommonLLMOptions {
  /** Optional analytics header: your site URL (HTTP-Referer). */
  httpReferer?: string;
  /** Optional analytics header: your app name (X-Title). */
  xTitle?: string;
  /** Request timeout in milliseconds (default: 180000). */
  timeout?: number;
}

/**
 * Reasoning-effort values accepted by Inceptron's reasoning models.
 *
 * Live-verified against zai-org/GLM-5.1-FP8: 'none', 'low', 'medium' and 'high'
 * are all accepted (no HTTP 400), so the provider-agnostic ReasoningEffort maps
 * 1:1. 'none' is the only mode that reliably suppresses the reasoning text and
 * returns a clean `content` (see InceptronAPIResponse for the caveats).
 */
export type InceptronReasoningEffort = ReasoningEffort;

/**
 * OpenAI-compatible content part for multimodal messages (image_url / data-URI),
 * identical to the Requesty/Azure providers.
 */
export type InceptronContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

/**
 * OpenAI-compatible request format for the Inceptron API.
 */
export interface InceptronAPIRequest {
  /** Model ID, e.g. "zai-org/GLM-5.1-FP8" (format: provider/model-name[-quant]). */
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | InceptronContentPart[];
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  /**
   * Reasoning effort. Live-verified to stabilise the response: when set (even to
   * 'none'), `content` was reliably populated; when omitted, `content` was
   * non-deterministic (sometimes empty with all text in `reasoning`). The
   * provider therefore always sends this field, defaulting to 'none'.
   */
  reasoning_effort?: InceptronReasoningEffort;
}

/**
 * OpenAI-compatible response from the Inceptron API.
 *
 * Two behaviours differ from a textbook OpenAI response (both live-verified
 * against zai-org/GLM-5.1-FP8 on https://openrouter.inceptron.io/v1):
 *  1. Reasoning text is returned in `message.reasoning` (OpenRouter style),
 *     NOT `reasoning_content` or `thinking`.
 *  2. `message.content` can be `null` (e.g. when the whole answer leaked into
 *     `reasoning`, or when max_tokens was exhausted by reasoning).
 *
 * `usage` carries no `reasoning_tokens` and no `cost`; reasoning tokens are
 * included in `completion_tokens` (so reasoningTokens cannot be tracked here).
 */
export interface InceptronAPIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      /** Can be null — handle defensively. */
      content: string | null;
      /** Reasoning/thinking text (present unless reasoning_effort='none'). */
      reasoning?: string | null;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    /** Reserved by the API but observed as null; may carry cached_tokens on cache hits. */
    prompt_tokens_details?: { cached_tokens?: number } | null;
  };
}

/**
 * Normalized Inceptron response (extends CommonLLMResponse).
 */
export interface InceptronResponse extends CommonLLMResponse {
  id?: string;
  finish_reason?: string;
}
