import {
  ThinkingExtractorFactory,
  NoOpThinkingExtractor,
  ThinkTagExtractor
} from '../../../../../src/middleware/services/llm/thinking';

describe('ThinkingExtractorFactory', () => {
  describe('get', () => {
    it('should return NoOpThinkingExtractor for "noop"', () => {
      const extractor = ThinkingExtractorFactory.get('noop');
      expect(extractor).toBeInstanceOf(NoOpThinkingExtractor);
      expect(extractor.name).toBe('noop');
    });

    it('should return ThinkTagExtractor for "think-tags"', () => {
      const extractor = ThinkingExtractorFactory.get('think-tags');
      expect(extractor).toBeInstanceOf(ThinkTagExtractor);
      expect(extractor.name).toBe('think-tags');
    });

    it('should return NoOpThinkingExtractor for unknown names', () => {
      const extractor = ThinkingExtractorFactory.get('unknown-extractor');
      expect(extractor).toBeInstanceOf(NoOpThinkingExtractor);
    });
  });

  describe('forModel', () => {
    describe('DeepSeek models', () => {
      it('should return ThinkTagExtractor for deepseek-r1', () => {
        const extractor = ThinkingExtractorFactory.forModel('deepseek-r1');
        expect(extractor).toBeInstanceOf(ThinkTagExtractor);
      });

      it('should return ThinkTagExtractor for deepseek-r1:14b', () => {
        const extractor = ThinkingExtractorFactory.forModel('deepseek-r1:14b');
        expect(extractor).toBeInstanceOf(ThinkTagExtractor);
      });

      it('should return ThinkTagExtractor for deepseek-coder (contains deepseek)', () => {
        const extractor = ThinkingExtractorFactory.forModel('deepseek-coder:6.7b');
        expect(extractor).toBeInstanceOf(ThinkTagExtractor);
      });

      it('should return ThinkTagExtractor for DeepSeek-R1 (case insensitive)', () => {
        const extractor = ThinkingExtractorFactory.forModel('DeepSeek-R1:32B');
        expect(extractor).toBeInstanceOf(ThinkTagExtractor);
      });
    });

    describe('QwQ models', () => {
      it('should return ThinkTagExtractor for qwq', () => {
        const extractor = ThinkingExtractorFactory.forModel('qwq');
        expect(extractor).toBeInstanceOf(ThinkTagExtractor);
      });

      it('should return ThinkTagExtractor for qwq:32b', () => {
        const extractor = ThinkingExtractorFactory.forModel('qwq:32b');
        expect(extractor).toBeInstanceOf(ThinkTagExtractor);
      });
    });

    describe('R1-like models', () => {
      it('should return ThinkTagExtractor for models containing -r1', () => {
        const extractor = ThinkingExtractorFactory.forModel('some-model-r1');
        expect(extractor).toBeInstanceOf(ThinkTagExtractor);
      });
    });

    describe('standard models (no thinking tags)', () => {
      it('should return NoOpThinkingExtractor for llama3', () => {
        const extractor = ThinkingExtractorFactory.forModel('llama3:8b');
        expect(extractor).toBeInstanceOf(NoOpThinkingExtractor);
      });

      it('should return NoOpThinkingExtractor for mistral', () => {
        const extractor = ThinkingExtractorFactory.forModel('mistral:7b');
        expect(extractor).toBeInstanceOf(NoOpThinkingExtractor);
      });

      it('should return NoOpThinkingExtractor for gemini models', () => {
        // Gemini handles thinking natively via API parts, not tags
        const extractor = ThinkingExtractorFactory.forModel('gemini-2.5-flash');
        expect(extractor).toBeInstanceOf(NoOpThinkingExtractor);
      });

      it('should return NoOpThinkingExtractor for claude models', () => {
        // Claude handles thinking via Extended Thinking API
        const extractor = ThinkingExtractorFactory.forModel('claude-3-5-sonnet-20241022');
        expect(extractor).toBeInstanceOf(NoOpThinkingExtractor);
      });

      it('should return NoOpThinkingExtractor for gpt models', () => {
        const extractor = ThinkingExtractorFactory.forModel('gpt-4o');
        expect(extractor).toBeInstanceOf(NoOpThinkingExtractor);
      });
    });
  });

  describe('usesThinkingTags', () => {
    it('should return true for deepseek models', () => {
      expect(ThinkingExtractorFactory.usesThinkingTags('deepseek-r1:14b')).toBe(true);
    });

    it('should return true for qwq models', () => {
      expect(ThinkingExtractorFactory.usesThinkingTags('qwq:32b')).toBe(true);
    });

    it('should return false for standard models', () => {
      expect(ThinkingExtractorFactory.usesThinkingTags('llama3:8b')).toBe(false);
      expect(ThinkingExtractorFactory.usesThinkingTags('gemini-2.5-flash')).toBe(false);
      expect(ThinkingExtractorFactory.usesThinkingTags('claude-3-5-sonnet')).toBe(false);
    });
  });

  describe('register (custom extractors)', () => {
    it('should allow registering custom extractors', () => {
      // Create a custom extractor
      const customExtractor = {
        name: 'custom-test',
        extract: (content: string) => ({
          content: content.toUpperCase(),
          thinking: 'custom thinking'
        })
      };

      ThinkingExtractorFactory.register('custom-test', customExtractor);
      const retrieved = ThinkingExtractorFactory.get('custom-test');

      expect(retrieved.name).toBe('custom-test');
      expect(retrieved.extract('hello').content).toBe('HELLO');
      expect(retrieved.extract('hello').thinking).toBe('custom thinking');
    });
  });

  describe('singleton behavior', () => {
    it('should return the same instance for repeated calls', () => {
      const extractor1 = ThinkingExtractorFactory.forModel('deepseek-r1');
      const extractor2 = ThinkingExtractorFactory.forModel('deepseek-r1:14b');

      // Both should be the same singleton instance
      expect(extractor1).toBe(extractor2);
    });

    it('should return the same NoOp instance for different standard models', () => {
      const extractor1 = ThinkingExtractorFactory.forModel('llama3:8b');
      const extractor2 = ThinkingExtractorFactory.forModel('mistral:7b');

      expect(extractor1).toBe(extractor2);
    });
  });
});
