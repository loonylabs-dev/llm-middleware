// NEW FILE: minimax.types.ts
import { CommonLLMOptions, CommonLLMResponse, ReasoningEffort } from './common.types';

/**
 * MiniMax-specific request options.
 *
 * MiniMax (MiniMax AI, Shanghai) serves its own models (MiniMax-M3, …) via an
 * OpenAI-compatible Chat Completions API. The wire format matches the Requesty
 * and Inceptron providers; what is MiniMax-specific is the RESPONSE shape, and
 * it is documented on the response type below.
 *
 * Auth, endpoint and model fall back to the common options, then to the
 * MINIMAX_API_KEY / MINIMAX_BASE_URL / MINIMAX_MODEL env vars.
 *
 * ⚠️ Not to be confused with MiniMax served THROUGH another gateway. The same
 * models are reachable via Bedrock (Converse) and Inceptron (OpenRouter-style),
 * and those paths behave differently — Bedrock returns native
 * `reasoningContent`, Inceptron returns `message.reasoning`. This provider
 * talks to MiniMax directly, where reasoning arrives inline (see below).
 */
export interface MiniMaxRequestOptions extends CommonLLMOptions {
  /** Request timeout in milliseconds (default: 300000 — see provider). */
  timeout?: number;
}

/**
 * Reasoning-effort values accepted by MiniMax.
 *
 * 🚨 **Accepted and ineffective.** Live-verified against MiniMax-M3 on
 * https://api.minimax.io/v1: sending `reasoning_effort: 'none'` returns HTTP
 * 200 and the response still contains a `<think>` block — with MORE reasoning
 * tokens than the call without it (20 vs 12). MiniMax uses always-on
 * interleaved thinking with no toggle, which the middleware already records for
 * the Bedrock path (`bedrock-reasoning.factory.ts`, `noop-minimax`).
 *
 * The field is therefore NOT sent by the provider. Typing it here documents
 * that the decision was measured rather than overlooked.
 */
export type MiniMaxReasoningEffort = ReasoningEffort;

/**
 * OpenAI-compatible content part for multimodal messages (image_url / data-URI),
 * identical to the Requesty/Inceptron/Azure providers.
 */
export type MiniMaxContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

/**
 * OpenAI-compatible request format for the MiniMax API.
 *
 * `response_format` is deliberately absent: live-verified that
 * `{ type: 'json_object' }` is accepted (HTTP 200) and does NOT constrain the
 * output — the answer still arrives wrapped in a `<think>` block, and asking
 * for a JSON array while declaring `json_object` puts two contradictory
 * constraints on the model. Callers state the shape they want in the prompt and
 * parse the extracted content.
 */
export interface MiniMaxAPIRequest {
  /** Model ID, e.g. "MiniMax-M3". */
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | MiniMaxContentPart[];
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

/**
 * OpenAI-compatible response from the MiniMax API.
 *
 * 🚨 **One behaviour differs from a textbook OpenAI response, and it is the
 * reason this provider exists** (live-verified against MiniMax-M3):
 *
 * **Reasoning arrives INLINE in `message.content`, as a `<think>…</think>`
 * block.** There is no `message.reasoning` (Inceptron/OpenRouter style) and no
 * `reasoningContent` (Bedrock style) — `message` carries exactly `content` and
 * `role`. A consumer that does not strip the block gets the model's working
 * notes prepended to every answer; in one measured case the block was 43 % of
 * the response.
 *
 * The provider therefore runs the ThinkTag extractor over `content` and reports
 * the result as the provider-agnostic `message.thinking`.
 *
 * `usage` is richer than Inceptron's: `reasoning_tokens` is broken out under
 * `completion_tokens_details` (it is INCLUDED in `completion_tokens`, not
 * additional), and `cached_tokens` appears under `prompt_tokens_details` on
 * cache hits. `total_characters` is a MiniMax extra and was 0 in every measured
 * call.
 */
export interface MiniMaxAPIResponse {
  id?: string;
  model?: string;
  choices: Array<{
    message?: {
      role?: string;
      /** Carries the answer AND, inline, a `<think>…</think>` block. */
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    /** MiniMax extra; measured as 0 in every observed call. */
    total_characters?: number;
    completion_tokens_details?: {
      /** Part of `completion_tokens`, not additional to it. */
      reasoning_tokens?: number;
    };
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  };
}

/**
 * Normalized MiniMax response, in the middleware's provider-agnostic shape.
 */
export interface MiniMaxResponse extends CommonLLMResponse {
  id?: string;
  finish_reason?: string;
}
