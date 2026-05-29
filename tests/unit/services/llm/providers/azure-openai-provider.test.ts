import axios from 'axios';
import { AzureOpenAIProvider } from '../../../../../src/middleware/services/llm/providers/azure-openai-provider';
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

const ENDPOINT = 'https://my-resource.openai.azure.com';
const REASONING_MODEL = 'o4-mini';
const STANDARD_MODEL = 'gpt-4o-mini';

// Minimal valid OpenAI Chat Completions response
const baseResponse = (overrides: Record<string, unknown> = {}) => ({
  status: 200,
  data: {
    id: 'chatcmpl-abc',
    object: 'chat.completion',
    created: 1700000000,
    model: 'o4-mini-2025-04-16',
    choices: [
      { index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    ...overrides
  }
});

describe('AzureOpenAIProvider', () => {
  let provider: AzureOpenAIProvider;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Isolate unit tests from any real .env values so behavior is deterministic
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_VERSION;
    provider = new AzureOpenAIProvider();
    mockedAxios.post.mockResolvedValue(baseResponse());
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  describe('endpoint URL', () => {
    it('should target the v1 chat/completions route (no api-version by default)', async () => {
      await provider.callWithSystemMessage('prompt', 'system', {
        authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://my-resource.openai.azure.com/openai/v1/chat/completions',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should append api-version as a query param when provided', async () => {
      await provider.callWithSystemMessage('prompt', 'system', {
        authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL, apiVersion: '2024-05-01-preview'
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://my-resource.openai.azure.com/openai/v1/chat/completions?api-version=2024-05-01-preview',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should strip trailing slashes from the endpoint', async () => {
      await provider.callWithSystemMessage('prompt', 'system', {
        authToken: 'k', endpoint: 'https://my-resource.openai.azure.com/', model: REASONING_MODEL
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://my-resource.openai.azure.com/openai/v1/chat/completions',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('authentication', () => {
    it('should send the API key in the api-key header (not Authorization)', async () => {
      await provider.callWithSystemMessage('prompt', 'system', {
        authToken: 'secret-key', endpoint: ENDPOINT, model: REASONING_MODEL
      });

      const config = mockedAxios.post.mock.calls[0][2] as any;
      expect(config.headers['api-key']).toBe('secret-key');
      expect(config.headers.Authorization).toBeUndefined();
    });

    it('should reject when no API key is available', async () => {
      await expect(
        provider.callWithSystemMessage('p', 's', { endpoint: ENDPOINT, model: REASONING_MODEL })
      ).rejects.toThrow('Azure OpenAI API key is required');
    });

    it('should reject when no endpoint is available', async () => {
      await expect(
        provider.callWithSystemMessage('p', 's', { authToken: 'k', model: REASONING_MODEL })
      ).rejects.toThrow('Azure OpenAI endpoint is required');
    });

    it('should reject when no deployment is available', async () => {
      await expect(
        provider.callWithSystemMessage('p', 's', { authToken: 'k', endpoint: ENDPOINT })
      ).rejects.toThrow('deployment name is required');
    });
  });

  describe('request payload — common', () => {
    it('should send the deployment name as the model field', async () => {
      await provider.callWithSystemMessage('p', 's', { authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.model).toBe(REASONING_MODEL);
    });

    it('should place the system message first, then the user message', async () => {
      await provider.callWithSystemMessage('my prompt', 'my system', { authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.messages).toEqual([
        { role: 'system', content: 'my system' },
        { role: 'user', content: 'my prompt' }
      ]);
    });

    it('should omit the system message when empty', async () => {
      await provider.callWithSystemMessage('my prompt', '', { authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.messages).toEqual([{ role: 'user', content: 'my prompt' }]);
    });
  });

  describe('request payload — reasoning model (o4-mini)', () => {
    it('should use max_completion_tokens and NOT send temperature/max_tokens', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL, maxTokens: 1234, temperature: 0.3
      });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.max_completion_tokens).toBe(1234);
      expect(body).not.toHaveProperty('max_tokens');
      expect(body).not.toHaveProperty('temperature');
      expect(body).not.toHaveProperty('top_p');
    });

    it('should forward reasoning_effort for low/medium/high', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL, reasoningEffort: 'high'
      });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.reasoning_effort).toBe('high');
    });

    it("should omit reasoning_effort for 'none'", async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL, reasoningEffort: 'none'
      });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body).not.toHaveProperty('reasoning_effort');
    });

    it('should treat a renamed deployment as reasoning when reasoningModel=true', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', endpoint: ENDPOINT, model: 'my-custom-deploy', reasoningModel: true, maxTokens: 500
      });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.max_completion_tokens).toBe(500);
      expect(body).not.toHaveProperty('temperature');
    });
  });

  describe('request payload — standard model (gpt-4o-mini)', () => {
    it('should use max_tokens + temperature and NOT send max_completion_tokens', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', endpoint: ENDPOINT, model: STANDARD_MODEL, maxTokens: 1234, temperature: 0.3, topP: 0.9
      });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.max_tokens).toBe(1234);
      expect(body.temperature).toBe(0.3);
      expect(body.top_p).toBe(0.9);
      expect(body).not.toHaveProperty('max_completion_tokens');
    });

    it('should forward temperature=0 verbatim (no falsy short-circuit)', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', endpoint: ENDPOINT, model: STANDARD_MODEL, temperature: 0
      });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.temperature).toBe(0);
    });

    it('should NOT send reasoning_effort for a standard model', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', endpoint: ENDPOINT, model: STANDARD_MODEL, reasoningEffort: 'high'
      });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body).not.toHaveProperty('reasoning_effort');
    });

    it('should force standard handling when reasoningModel=false even for an o-name', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL, reasoningModel: false, temperature: 0.5
      });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBeDefined();
      expect(body).not.toHaveProperty('max_completion_tokens');
    });
  });

  describe('response normalization', () => {
    it('should extract content and normalize token usage', async () => {
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL });
      expect(response?.message.content).toBe('Hello!');
      expect(response?.usage).toEqual(expect.objectContaining({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15
      }));
      expect(response?.metadata?.provider).toBe('azure_openai');
    });

    it('should map reasoning_tokens to usage.reasoningTokens', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        usage: {
          prompt_tokens: 13, completion_tokens: 84, total_tokens: 97,
          completion_tokens_details: { reasoning_tokens: 64 }
        }
      }));
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL });
      expect(response?.usage?.reasoningTokens).toBe(64);
    });

    it('should map cached_tokens to cacheMetadata.cacheReadTokens', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        usage: {
          prompt_tokens: 100, completion_tokens: 5, total_tokens: 105,
          prompt_tokens_details: { cached_tokens: 80 }
        }
      }));
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL });
      expect(response?.usage?.cacheMetadata?.cacheReadTokens).toBe(80);
    });

    it('should surface finish_reason', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        choices: [{ index: 0, message: { role: 'assistant', content: 'x' }, finish_reason: 'length' }]
      }));
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL });
      expect((response as any)?.finish_reason).toBe('length');
    });

    it('should return null on a non-200 status', async () => {
      mockedAxios.post.mockResolvedValue({ status: 500, data: { error: { message: 'server error' } } });
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL });
      expect(response).toBeNull();
    });
  });

  describe('debug logging — reasoning visibility', () => {
    it('puts reasoningEffort (input) and reasoningTokens (output) into the debug log info', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        usage: {
          prompt_tokens: 13, completion_tokens: 84, total_tokens: 97,
          completion_tokens_details: { reasoning_tokens: 64 }
        }
      }));

      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', endpoint: ENDPOINT, model: REASONING_MODEL, reasoningEffort: 'high'
      });

      const logResponseMock = (LLMDebugger as unknown as { logResponse: jest.Mock }).logResponse;
      const debugInfoArg = logResponseMock.mock.calls[0][0];
      expect(debugInfoArg.reasoningEffort).toBe('high');
      expect(debugInfoArg.reasoningTokens).toBe(64);
    });
  });

  describe('provider identity', () => {
    it('should report the azure_openai provider name', () => {
      expect(provider.getProviderName()).toBe('azure_openai');
    });
  });
});
