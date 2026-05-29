import axios from 'axios';
import { BedrockProvider } from '../../../../../src/middleware/services/llm/providers/bedrock-provider';

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

const MODEL = 'qwen.qwen3-32b-v1:0';

// Minimal valid Converse response
const baseResponse = (overrides: Record<string, unknown> = {}) => ({
  status: 200,
  data: {
    output: { message: { role: 'assistant', content: [{ text: 'Hello!' }] } },
    stopReason: 'end_turn',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    metrics: { latencyMs: 100 },
    ...overrides
  }
});

describe('BedrockProvider', () => {
  let provider: BedrockProvider;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Isolate unit tests from any real .env values so behavior is deterministic
    delete process.env.BEDROCK_API_KEY;
    delete process.env.BEDROCK_MODEL;
    delete process.env.BEDROCK_REGION;
    provider = new BedrockProvider();
    mockedAxios.post.mockResolvedValue(baseResponse());
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  describe('endpoint URL', () => {
    it('should target the bedrock-runtime Converse endpoint with model id and default region', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { authToken: 'k', model: MODEL });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://bedrock-runtime.eu-central-1.amazonaws.com/model/qwen.qwen3-32b-v1:0/converse',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should honor a custom region', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { authToken: 'k', model: MODEL, region: 'eu-west-1' });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('bedrock-runtime.eu-west-1.amazonaws.com'),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('authentication', () => {
    it('should send the API key as a Bearer token', async () => {
      await provider.callWithSystemMessage('prompt', 'system', { authToken: 'secret-key', model: MODEL });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer secret-key' })
        })
      );
    });

    it('should reject when no API key is available', async () => {
      const saved = process.env.BEDROCK_API_KEY;
      delete process.env.BEDROCK_API_KEY;
      try {
        await expect(
          provider.callWithSystemMessage('prompt', 'system', { model: MODEL })
        ).rejects.toThrow('AWS Bedrock API key is required');
      } finally {
        if (saved !== undefined) process.env.BEDROCK_API_KEY = saved;
      }
    });

    it('should reject when no model is available', async () => {
      const saved = process.env.BEDROCK_MODEL;
      delete process.env.BEDROCK_MODEL;
      try {
        await expect(
          provider.callWithSystemMessage('prompt', 'system', { authToken: 'k' })
        ).rejects.toThrow('Model name is required');
      } finally {
        if (saved !== undefined) process.env.BEDROCK_MODEL = saved;
      }
    });
  });

  describe('Converse request payload', () => {
    it('should send messages in Converse content-block shape', async () => {
      await provider.callWithSystemMessage('my prompt', 'system', { authToken: 'k', model: MODEL });

      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.messages).toEqual([{ role: 'user', content: [{ text: 'my prompt' }] }]);
    });

    it('should place the system prompt in a top-level system array', async () => {
      await provider.callWithSystemMessage('p', 'my system msg', { authToken: 'k', model: MODEL });

      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.system).toEqual([{ text: 'my system msg' }]);
    });

    it('should omit the system array when the system message is empty', async () => {
      await provider.callWithSystemMessage('p', '', { authToken: 'k', model: MODEL });

      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body).not.toHaveProperty('system');
    });

    it('should put inference parameters inside inferenceConfig', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', model: MODEL, temperature: 0.3, maxTokens: 1234, topP: 0.9, stopSequences: ['END']
      });

      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.inferenceConfig).toEqual({
        maxTokens: 1234,
        temperature: 0.3,
        topP: 0.9,
        stopSequences: ['END']
      });
    });

    it('should default maxTokens to 4096 and temperature to 0.7', async () => {
      await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });

      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.inferenceConfig.maxTokens).toBe(4096);
      expect(body.inferenceConfig.temperature).toBe(0.7);
    });

    it('should forward temperature=0 verbatim (no falsy short-circuit)', async () => {
      await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL, temperature: 0 });

      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.inferenceConfig.temperature).toBe(0);
    });
  });

  describe('response normalization', () => {
    it('should extract text content and normalize token usage', async () => {
      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });

      expect(response?.message.content).toBe('Hello!');
      expect(response?.usage).toEqual(expect.objectContaining({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15
      }));
      expect(response?.metadata?.provider).toBe('bedrock');
      expect(response?.metadata?.region).toBe('eu-central-1');
    });

    it('should join multiple text blocks', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        output: { message: { role: 'assistant', content: [{ text: 'part 1' }, { text: 'part 2' }] } }
      }));

      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect(response?.message.content).toBe('part 1\npart 2');
    });

    it('should surface stopReason', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({ stopReason: 'max_tokens' }));

      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect((response as any)?.stopReason).toBe('max_tokens');
    });

    it('should map native reasoningContent to message.thinking', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        output: {
          message: {
            role: 'assistant',
            content: [
              { reasoningContent: { reasoningText: { text: 'step-by-step reasoning' } } },
              { text: 'final answer' }
            ]
          }
        }
      }));

      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect(response?.message.content).toBe('final answer');
      expect(response?.message.thinking).toBe('step-by-step reasoning');
    });

    it('should expose cache token counts via cacheMetadata', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, cacheReadInputTokens: 8 }
      }));

      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect(response?.usage?.cacheMetadata?.cacheReadTokens).toBe(8);
    });

    it('should return null on a non-200 status', async () => {
      mockedAxios.post.mockResolvedValue({ status: 500, data: { message: 'server error' } });

      const response = await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      expect(response).toBeNull();
    });
  });

  describe('reasoning integration', () => {
    it('forwards reasoning_effort for open-weight models (Kimi/Qwen/gpt-oss/GLM/DeepSeek)', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', model: 'moonshotai.kimi-k2.5', reasoningEffort: 'high'
      });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.additionalModelRequestFields).toEqual({ reasoning_effort: 'high' });
    });

    it('uses reasoningConfig and strips forbidden inference params for Nova at high', async () => {
      await provider.callWithSystemMessage('p', 's', {
        authToken: 'k', model: 'eu.amazon.nova-2-lite-v1:0', reasoningEffort: 'high', temperature: 0.5
      });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body.additionalModelRequestFields).toEqual({
        reasoningConfig: { type: 'enabled', maxReasoningEffort: 'high' }
      });
      expect(body.inferenceConfig).not.toHaveProperty('temperature');
      expect(body.inferenceConfig).not.toHaveProperty('maxTokens');
    });

    it('omits additionalModelRequestFields when reasoningEffort is unset', async () => {
      await provider.callWithSystemMessage('p', 's', { authToken: 'k', model: MODEL });
      const body = mockedAxios.post.mock.calls[0][1] as any;
      expect(body).not.toHaveProperty('additionalModelRequestFields');
    });
  });

  describe('provider identity', () => {
    it('should report the bedrock provider name', () => {
      expect(provider.getProviderName()).toBe('bedrock');
    });
  });
});
