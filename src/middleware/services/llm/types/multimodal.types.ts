/**
 * Multimodal content types for vision/image input support.
 * Enables sending images alongside text to LLM providers.
 *
 * Design decisions:
 * - Base64 only (no URLs) — Gemini doesn't support direct URLs, base64 is universal
 * - type: 'image' (not 'image_url') — follows Vercel AI SDK / Anthropic convention
 * - Explicit mimeType — required by Gemini and Anthropic, safer than inference
 *
 * @since 2.22.0
 */

/**
 * Text content part for multimodal messages.
 */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/**
 * Image content part for multimodal messages.
 * Uses base64-encoded image data (without data-URI prefix).
 */
export interface ImageContentPart {
  type: 'image';
  /** Base64-encoded image data (without data: URI prefix) */
  data: string;
  /** MIME type of the image */
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  /**
   * Optional resolution/detail hint.
   * - OpenAI: maps to `detail` parameter (low/high/auto)
   * - Gemini: could map to media_resolution (not currently used)
   * - Anthropic: ignored (no equivalent)
   */
  detail?: 'low' | 'high' | 'auto';
}

/**
 * Union type for all content part types.
 * Extensible for future content types (audio, video, etc.).
 */
export type ContentPart = TextContentPart | ImageContentPart;

/**
 * Multimodal content: either a plain string (backward-compatible) or an array of content parts.
 * When a string is provided, it is internally normalized to [{ type: 'text', text: string }].
 */
export type MultimodalContent = string | ContentPart[];
