import {
  normalizeContent,
  extractTextContent,
  contentToDebugString,
  contentLength,
  hasImages,
  countImages,
} from '../../../../../src/middleware/services/llm/utils/multimodal.utils';
import { ContentPart, MultimodalContent } from '../../../../../src/middleware/services/llm/types/multimodal.types';

describe('multimodal.utils', () => {
  // A small base64 string (~100 bytes decoded)
  const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const textPart: ContentPart = { type: 'text', text: 'Hello world' };
  const imagePart: ContentPart = {
    type: 'image',
    data: sampleBase64,
    mimeType: 'image/png',
  };

  describe('normalizeContent', () => {
    it('should convert a plain string to a single TextContentPart array', () => {
      const result = normalizeContent('hello');
      expect(result).toEqual([{ type: 'text', text: 'hello' }]);
    });

    it('should return the same array when given ContentPart[]', () => {
      const parts: ContentPart[] = [textPart, imagePart];
      const result = normalizeContent(parts);
      expect(result).toBe(parts); // same reference
    });

    it('should handle empty string', () => {
      const result = normalizeContent('');
      expect(result).toEqual([{ type: 'text', text: '' }]);
    });

    it('should handle empty array', () => {
      const result = normalizeContent([]);
      expect(result).toEqual([]);
    });
  });

  describe('extractTextContent', () => {
    it('should return the string directly for string input', () => {
      expect(extractTextContent('hello')).toBe('hello');
    });

    it('should extract text from mixed content parts', () => {
      const result = extractTextContent([textPart, imagePart, { type: 'text', text: 'world' }]);
      expect(result).toBe('Hello world\nworld');
    });

    it('should return empty string when only images', () => {
      expect(extractTextContent([imagePart])).toBe('');
    });
  });

  describe('contentToDebugString', () => {
    it('should return the string directly for string input', () => {
      expect(contentToDebugString('hello')).toBe('hello');
    });

    it('should replace images with placeholder', () => {
      const result = contentToDebugString([textPart, imagePart]);
      expect(result).toContain('Hello world');
      expect(result).toContain('[IMAGE: image/png,');
      expect(result).not.toContain(sampleBase64);
    });

    it('should show MIME type and approximate size', () => {
      const result = contentToDebugString([imagePart]);
      expect(result).toMatch(/\[IMAGE: image\/png, \d+(\.\d+)?(B|KB|MB)\]/);
    });

    it('should handle text-only content parts', () => {
      const result = contentToDebugString([textPart]);
      expect(result).toBe('Hello world');
    });
  });

  describe('contentLength', () => {
    it('should return string length for string input', () => {
      expect(contentLength('hello')).toBe(5);
    });

    it('should return debug string length for content parts', () => {
      const len = contentLength([textPart, imagePart]);
      expect(len).toBeGreaterThan(0);
      // Should not include base64 data length
      expect(len).toBeLessThan(sampleBase64.length);
    });
  });

  describe('hasImages', () => {
    it('should return false for string input', () => {
      expect(hasImages('hello')).toBe(false);
    });

    it('should return false for text-only content parts', () => {
      expect(hasImages([textPart])).toBe(false);
    });

    it('should return true when content contains images', () => {
      expect(hasImages([textPart, imagePart])).toBe(true);
    });

    it('should return true for image-only content', () => {
      expect(hasImages([imagePart])).toBe(true);
    });

    it('should return false for empty array', () => {
      expect(hasImages([])).toBe(false);
    });
  });

  describe('countImages', () => {
    it('should return 0 for string input', () => {
      expect(countImages('hello')).toBe(0);
    });

    it('should return 0 for text-only parts', () => {
      expect(countImages([textPart])).toBe(0);
    });

    it('should count image parts correctly', () => {
      expect(countImages([textPart, imagePart, imagePart])).toBe(2);
    });

    it('should return 0 for empty array', () => {
      expect(countImages([])).toBe(0);
    });
  });
});
