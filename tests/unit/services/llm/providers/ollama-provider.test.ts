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

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OllamaProvider();
    
    // Mock successful response
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: {
        model: 'qwen3.5',
        message: {
          role: 'assistant',
          content: 'Hello!'
        },
        prompt_eval_count: 10,
        eval_count: 20
      }
    });
  });

  it('should include think: false in request data when explicitly set', async () => {
    await provider.callWithSystemMessage(
      'User prompt',
      'System message',
      { model: 'qwen3.5', think: false }
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat'),
      expect.objectContaining({
        think: false
      }),
      expect.any(Object)
    );
  });

  it('should include think: true in request data when reasoningEffort is not none', async () => {
    await provider.callWithSystemMessage(
      'User prompt',
      'System message',
      { model: 'qwen3.5', reasoningEffort: 'high' }
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat'),
      expect.objectContaining({
        think: true
      }),
      expect.any(Object)
    );
  });

  it('should include think: false in request data when reasoningEffort is none', async () => {
    await provider.callWithSystemMessage(
      'User prompt',
      'System message',
      { model: 'qwen3.5', reasoningEffort: 'none' }
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat'),
      expect.objectContaining({
        think: false
      }),
      expect.any(Object)
    );
  });

  it('should use custom timeout in axios call', async () => {
    const customTimeout = 50000;
    await provider.callWithSystemMessage(
      'User prompt',
      'System message',
      { model: 'qwen3.5', timeout: customTimeout }
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        timeout: customTimeout
      })
    );
  });

  it('should use default timeout (180000) when not specified', async () => {
    await provider.callWithSystemMessage(
      'User prompt',
      'System message',
      { model: 'qwen3.5' }
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        timeout: 180000
      })
    );
  });
});
