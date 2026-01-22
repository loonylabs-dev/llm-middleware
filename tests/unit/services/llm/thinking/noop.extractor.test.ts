import { NoOpThinkingExtractor } from '../../../../../src/middleware/services/llm/thinking';

describe('NoOpThinkingExtractor', () => {
  let extractor: NoOpThinkingExtractor;

  beforeEach(() => {
    extractor = new NoOpThinkingExtractor();
  });

  describe('name property', () => {
    it('should have name "noop"', () => {
      expect(extractor.name).toBe('noop');
    });
  });

  describe('extract', () => {
    it('should return content unchanged', () => {
      const input = 'This is the content';
      const result = extractor.extract(input);

      expect(result.content).toBe(input);
      expect(result.thinking).toBeUndefined();
    });

    it('should NOT extract thinking tags (pass through as-is)', () => {
      const input = '<think>Some thinking</think>Some content';
      const result = extractor.extract(input);

      // NoOp extractor should NOT extract thinking - that's its purpose
      expect(result.content).toBe(input);
      expect(result.thinking).toBeUndefined();
    });

    it('should handle empty string', () => {
      const result = extractor.extract('');

      expect(result.content).toBe('');
      expect(result.thinking).toBeUndefined();
    });

    it('should handle JSON content', () => {
      const json = '{"key": "value", "nested": {"a": 1}}';
      const result = extractor.extract(json);

      expect(result.content).toBe(json);
      expect(result.thinking).toBeUndefined();

      // Verify JSON is preserved
      const parsed = JSON.parse(result.content);
      expect(parsed.key).toBe('value');
    });

    it('should handle multiline content', () => {
      const input = `Line 1
Line 2
Line 3`;
      const result = extractor.extract(input);

      expect(result.content).toBe(input);
      expect(result.thinking).toBeUndefined();
    });
  });
});
