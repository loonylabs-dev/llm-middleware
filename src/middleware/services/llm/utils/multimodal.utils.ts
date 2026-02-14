/**
 * Utility functions for multimodal content handling.
 * Provides normalization, debug formatting, and inspection helpers.
 *
 * @since 2.22.0
 */

import { MultimodalContent, ContentPart, ImageContentPart } from '../types/multimodal.types';

/**
 * Normalizes MultimodalContent to ContentPart[].
 * Converts a plain string to a single TextContentPart array.
 *
 * @param content - String or ContentPart array
 * @returns Normalized ContentPart array
 */
export function normalizeContent(content: MultimodalContent): ContentPart[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  return content;
}

/**
 * Extracts the combined text content from MultimodalContent.
 * Only includes text parts, ignores images.
 *
 * @param content - String or ContentPart array
 * @returns Combined text from all text parts
 */
export function extractTextContent(content: MultimodalContent): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

/**
 * Creates a debug-safe string representation of MultimodalContent.
 * Images are replaced with placeholder strings showing type and size.
 * This prevents base64 blobs from appearing in logs.
 *
 * @param content - String or ContentPart array
 * @returns Debug-safe string representation
 */
export function contentToDebugString(content: MultimodalContent): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .map(part => {
      if (part.type === 'text') {
        return part.text;
      }
      // Calculate approximate size of base64 data
      const sizeBytes = Math.ceil(part.data.length * 3 / 4);
      const sizeStr = formatByteSize(sizeBytes);
      return `[IMAGE: ${part.mimeType}, ${sizeStr}]`;
    })
    .join('\n');
}

/**
 * Returns the effective "length" of MultimodalContent for metrics/logging.
 * For strings, returns string length. For content parts, returns
 * the debug string length (images counted as placeholder length).
 *
 * @param content - String or ContentPart array
 * @returns Character length suitable for metrics
 */
export function contentLength(content: MultimodalContent): number {
  if (typeof content === 'string') {
    return content.length;
  }
  return contentToDebugString(content).length;
}

/**
 * Checks whether MultimodalContent contains any image parts.
 *
 * @param content - String or ContentPart array
 * @returns true if content contains at least one image part
 */
export function hasImages(content: MultimodalContent): boolean {
  if (typeof content === 'string') {
    return false;
  }
  return content.some(part => part.type === 'image');
}

/**
 * Counts the number of image parts in MultimodalContent.
 *
 * @param content - String or ContentPart array
 * @returns Number of image parts
 */
export function countImages(content: MultimodalContent): number {
  if (typeof content === 'string') {
    return 0;
  }
  return content.filter(part => part.type === 'image').length;
}

/**
 * Formats a byte size into a human-readable string.
 * @internal
 */
function formatByteSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
