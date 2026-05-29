import axios from 'axios';
import { InceptronProvider } from '../../../../../src/middleware/services/llm/providers/inceptron-provider';
import { logger } from '../../../../../src/middleware/shared/utils/logging.utils';

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

const MODEL = 'zai-org/GLM-5.1-FP8';
const DEFAULT_BASE_URL = 'https://openrouter.inceptron.io/v1';

// Minimal valid Inceptron (OpenAI-compatible) Chat Completions response.
// Inceptron specifics: reasoning text lives in `message.reasoning`, `content` may be null.
const baseResponse = (overrides: Record<string, unknown> = {}) => ({
  status: 200,
  data: {
    id: 'chatcmpl-abc',
    object: 'chat.completion',
    created: 1700000000,
    model: MODEL,
    choices: [
      { index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, prompt_tokens_details: null },
    ...overrides
  }
});

describe('InceptronProvider', () => {
  let provider: InceptronProvider;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Isolate unit tests from any real .env values so behavior is deterministic
    delete process.env.INCEPTRON_API_KEY;
    delete process.env.INCEPTRON_MODEL;
    delete process.env.INCEPTRON_BASE_URL;
    provider = new InceptronProvider();
    mockedAxios.post.mockResolvedValue(baseResponse());
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  describe('endpoint URL', () => {
    it('should target the default openrouter.inceptron.io/v1 chat/completions route', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { authToken: 'k', model: MODEL });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${DEFAULT_BASE_URL}/chat/completions`,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should honor a baseUrl override and strip trailing slashes', async () => {
      await provider.callWithSystemMessage('prompt', 'system', {
        authToken: 'k', model: MODEL, baseUrl: 'https://api.inceptron.io/v1/'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.inceptron.io/v1/chat/completions',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should read the base URL from INCEPTRON_BASE_URL env', async () => {
      process.env.INCEPTRON_BASE_URL = 'https://api.inceptron.io/v1';
      await provider.callWithSystemMessage('prompt', 'system', { authToken: 'k', model: MODEL });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.inceptron.io/v1/chat/completions',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('authentication', () => {
    it('should send the API key as Authorization: Bearer', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { authToken: 'secret-key', model: MODEL });

      const config = mockedAxios.post.mock.calls[0][2] as any;
      expect(config.headers.Authorization).toBe('Bearer secret-key');
    });

    it('should reject when no API key is available', async () => {
      await expect(
        provider.callWithSystemMessage('p', 's', { model: MODEL })
      ).rejects.toThrow('Inceptron API key is required');
    });

    it('should send optional analytics headers when provided', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', model: MODEL, httpReferer: 'https://example.com', xTitle: 'MyApp'
      });
      const config = mockedAxios.post.mock.calls[0][2] as any;
      expect(config.headers['HTTP-Referer']).toBe('https://example.com');
      expect(config.headers['X-Title']).toBe('MyApp');
    });
  });

  describe('request payload', () => {
    it('should place the system message first, then the user message', async () => {
      await provider.callWithSystemMessage('my prompt', 'my system', { authToken: 'k', model: MODEL });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.messages).toEqual([
        { role: 'system', content: 'my system' },
        { role: 'user', content: 'my prompt' }
      ]);
    });

    it('should omit the system message when empty', async () => {
      await provider.callWithSystemMessage('my prompt', '', { authToken: 'k', model: MODEL });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.messages).toEqual([{ role: 'user', content: 'my prompt' }]);
    });

    it("should ALWAYS send reasoning_effort, defaulting to 'none' (avoids non-deterministic empty content)", async () => {
      await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.reasoning_effort).toBe('none');
    });

    it.each(['none', 'low', 'medium', 'high'] as const)(
      "should forward reasoning_effort '%s' verbatim (1:1 mapping, all live-verified)",
      async (effort) => {
        await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL, reasoningEffort: effort });
        const body = mockedAxios.post.mock.calls[0][1] as any;
        expect(body.reasoning_effort).toBe(effort);
      }
    );

    it('should send max_tokens and temperature', async () => {
      await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL, maxTokens: 1234, temperature: 0.3 });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.max_tokens).toBe(1234);
      expect(body.temperature).toBe(0.3);
    });

    it('should forward temperature=0 verbatim (no falsy short-circuit)', async () => {
      await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL, temperature: 0 });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.temperature).toBe(0);
    });

    it('should send the model id as the model field', async () => {
      await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.model).toBe(MODEL);
    });
  });

  describe('response normalization', () => {
    it('should extract content and normalize token usage', async () => {
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect(response?.message.content).toBe('Hello!');
      expect(response?.usage).toEqual(expect.objectContaining({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15
      }));
      expect(response?.metadata?.provider).toBe('inceptron');
    });

    it('should map message.reasoning to message.thinking (OpenRouter style)', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'The answer is 42.', reasoning: 'Let me think step by step...' },
          finish_reason: 'stop'
        }]
      }));
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect(response?.message.content).toBe('The answer is 42.');
      expect(response?.message.thinking).toBe('Let me think step by step...');
    });

    it('should treat null content as an empty string', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        choices: [{ index: 0, message: { role: 'assistant', content: null }, finish_reason: 'stop' }]
      }));
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect(response?.message.content).toBe('');
    });

    it('should NOT report reasoningTokens (the API does not return reasoning_tokens)', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'answer', reasoning: 'long reasoning here' },
          finish_reason: 'stop'
        }]
      }));
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect(response?.usage?.reasoningTokens).toBeUndefined();
    });

    it('should map prompt_tokens_details.cached_tokens to cacheMetadata.cacheReadTokens', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        usage: {
          prompt_tokens: 100, completion_tokens: 5, total_tokens: 105,
          prompt_tokens_details: { cached_tokens: 80 }
        }
      }));
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect(response?.usage?.cacheMetadata?.cacheReadTokens).toBe(80);
    });

    it('should surface finish_reason', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        choices: [{ index: 0, message: { role: 'assistant', content: 'x' }, finish_reason: 'length' }]
      }));
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect((response as any)?.finish_reason).toBe('length');
    });

    it('should return null on a non-200 status', async () => {
      mockedAxios.post.mockResolvedValue({ status: 500, data: { error: { message: 'server error' } } });
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect(response).toBeNull();
    });
  });

  describe('empty content with reasoning present', () => {
    it('should warn when content is empty but reasoning is present', async () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as any);
      mockedAxios.post.mockResolvedValue(baseResponse({
        choices: [{
          index: 0,
          message: { role: 'assistant', content: null, reasoning: 'all the text leaked into reasoning' },
          finish_reason: 'stop'
        }]
      }));

      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });

      expect(response?.message.content).toBe('');
      expect(response?.message.thinking).toBe('all the text leaked into reasoning');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('empty content'),
        expect.objectContaining({ context: 'InceptronProvider' })
      );
      warnSpy.mockRestore();
    });

    it('should NOT warn when content is present alongside reasoning', async () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as any);
      mockedAxios.post.mockResolvedValue(baseResponse({
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'real answer', reasoning: 'some reasoning' },
          finish_reason: 'stop'
        }]
      }));

      await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('provider identity', () => {
    it('should report the inceptron provider name', () => {
      expect(provider.getProviderName()).toBe('inceptron');
    });
  });
});
