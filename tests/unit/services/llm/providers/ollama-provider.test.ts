import axios from 'axios';
import { OllamaProvider } from '../../../../../src/middleware/services/llm/providers/ollama-provider';
import { LLMDebugger } from '../../../../../src/middleware/services/llm/utils/debug-llm.utils';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock LLMDebugger to avoid file system operations
jest.mock('../../../../../src/middleware/services/llm/utils/debug-llm.utils', () => ({
  LLMDebugger: {
    logRequest: jest.fn().mockResolvedValue(undefined),
    logResponse: jest.fn().mockResolvedValue(undefined),
    logError: jest.fn().mockResolvedValue(undefined)
  }
}));

const baseResponse = (overrides = {}) => ({
  status: 200,
  data: {
    model: 'qwen3.5',
    message: { role: 'assistant', content: 'Hello!' },
    prompt_eval_count: 10,
    eval_count: 20,
    ...overrides
  }
});

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OllamaProvider();
    mockedAxios.post.mockResolvedValue(baseResponse());
  });

  describe('reasoningEffort → think mapping', () => {
    it('should send think=true when reasoningEffort is high', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { model: 'qwen3.5', reasoningEffort: 'high' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({ think: true }),
        expect.any(Object)
      );
    });

    it('should send think=true when reasoningEffort is medium', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { model: 'qwen3.5', reasoningEffort: 'medium' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({ think: true }),
        expect.any(Object)
      );
    });

    it('should send think=true when reasoningEffort is low', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { model: 'qwen3.5', reasoningEffort: 'low' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({ think: true }),
        expect.any(Object)
      );
    });

    it('should send think=false when reasoningEffort is none', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { model: 'qwen3.5', reasoningEffort: 'none' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({ think: false }),
        expect.any(Object)
      );
    });

    it('should omit think entirely when reasoningEffort is not set', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { model: 'qwen3.5' });

      const callArgs = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
      expect(callArgs).not.toHaveProperty('think');
    });
  });

  describe('native Ollama thinking field', () => {
    it('should populate debugInfo.thinking from message.thinking when no <think> tags present', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        message: {
          role: 'assistant',
          content: 'Clean answer',
          thinking: 'This is the native thinking content'
        }
      }));

      await provider.callWithSystemMessage('prompt', 'system', { model: 'qwen3.5', reasoningEffort: 'high' });

      const logResponseCall = (LLMDebugger.logResponse as jest.Mock).mock.calls[0][0];
      expect(logResponseCall.thinking).toBe('This is the native thinking content');
    });
  });

  describe('timeout', () => {
    it('should use custom timeout in axios call', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { model: 'qwen3.5', timeout: 50000 });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ timeout: 50000 })
      );
    });

    it('should use default timeout (180000) when not specified', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { model: 'qwen3.5' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ timeout: 180000 })
      );
    });
  });
});
