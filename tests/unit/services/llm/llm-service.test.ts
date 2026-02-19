import { LLMService } from '../../../../src/middleware/services/llm/llm.service';
import { LLMProvider } from '../../../../src/middleware/services/llm/types';
import { VertexAIProvider } from '../../../../src/middleware/services/llm/providers/gemini';

// Mock the logger to avoid console output in tests
jest.mock('../../../../src/middleware/shared/utils/logging.utils', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('LLMService', () => {
  describe('registerProvider', () => {
    it('should replace an existing provider', () => {
      const service = new LLMService();
      const customProvider = new VertexAIProvider({
        regionRotation: {
          regions: ['europe-west3', 'europe-west1'],
          fallback: 'global',
        },
      });

      service.registerProvider(LLMProvider.VERTEX_AI, customProvider);
      expect(service.getProvider(LLMProvider.VERTEX_AI)).toBe(customProvider);
    });

    it('should not affect other providers', () => {
      const service = new LLMService();
      const originalAnthropic = service.getProvider(LLMProvider.ANTHROPIC);

      service.registerProvider(LLMProvider.VERTEX_AI, new VertexAIProvider());
      expect(service.getProvider(LLMProvider.ANTHROPIC)).toBe(originalAnthropic);
    });
  });
});
