/**
 * Provider-level retry integration tests.
 *
 * Verifies that providers correctly use retryWithBackoff for their HTTP calls,
 * retrying on transient errors (429, 5xx) and NOT retrying on client errors (401, 400).
 */

import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
jest.mock('../../../../../src/middleware/shared/utils/logging.utils', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    system: jest.fn(),
  },
}));

// Mock DataFlowLoggerService
jest.mock('../../../../../src/middleware/services/data-flow-logger', () => ({
  DataFlowLoggerService: {
    getInstance: () => ({
      startRequest: jest.fn().mockReturnValue('req-id'),
      logLLMRequest: jest.fn(),
      logLLMResponse: jest.fn(),
    }),
  },
}));

// Mock LLMDebugger
jest.mock('../../../../../src/middleware/services/llm/utils/debug-llm.utils', () => ({
  LLMDebugger: {
    logRequest: jest.fn(),
    logResponse: jest.fn(),
    logError: jest.fn(),
  },
  LLMDebugInfo: {},
}));

// Mock ThinkingExtractorFactory
jest.mock('../../../../../src/middleware/services/llm/thinking', () => ({
  ThinkingExtractorFactory: {
    forModel: () => ({
      extract: (text: string) => ({ content: text, thinking: undefined }),
    }),
  },
}));

/**
 * Creates a mock Axios error.
 */
function createAxiosError(status: number, data?: any) {
  const error: any = new Error(`Request failed with status code ${status}`);
  error.isAxiosError = true;
  error.response = {
    status,
    statusText: `Status ${status}`,
    headers: {},
    data: data || { error: 'test error' },
  };
  return error;
}

/**
 * Creates a successful Gemini API response.
 */
function createGeminiResponse() {
  return {
    status: 200,
    data: {
      candidates: [{
        content: {
          parts: [{ text: 'Hello from Gemini' }],
        },
        finishReason: 'STOP',
      }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    },
  };
}

/**
 * Creates a successful Anthropic API response.
 */
function createAnthropicResponse() {
  return {
    status: 200,
    data: {
      id: 'msg-123',
      content: [{ type: 'text', text: 'Hello from Claude' }],
      model: 'claude-3-5-sonnet-20241022',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 5,
      },
    },
  };
}

/**
 * Creates a successful Requesty API response.
 */
function createRequestyResponse() {
  return {
    status: 200,
    data: {
      id: 'chatcmpl-123',
      choices: [{ message: { content: 'Hello from Requesty' }, finish_reason: 'stop' }],
      model: 'openai/gpt-4o',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    },
  };
}

// Fast retry config to avoid slow tests
const fastRetry = {
  retry: {
    enabled: true,
    maxRetries: 2,
    initialDelayMs: 1,
    multiplier: 1,
    maxDelayMs: 2,
    jitter: false,
  },
};

describe('GeminiDirectProvider - Retry Integration', () => {
  let provider: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Import fresh to avoid state leaking
    const { GeminiDirectProvider } = require('../../../../../src/middleware/services/llm/providers/gemini/gemini-direct.provider');
    provider = new GeminiDirectProvider();
  });

  it('should retry on 429 and succeed on second attempt', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(createAxiosError(429))
      .mockResolvedValueOnce(createGeminiResponse());

    const result = await provider.callWithSystemMessage('Hello', 'Be helpful', {
      model: 'gemini-2.5-flash',
      authToken: 'test-key',
      ...fastRetry,
    });

    expect(result).not.toBeNull();
    expect(result!.message.content).toBe('Hello from Gemini');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });

  it('should retry on 503 and succeed on second attempt', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(createAxiosError(503))
      .mockResolvedValueOnce(createGeminiResponse());

    const result = await provider.callWithSystemMessage('Hello', 'Be helpful', {
      model: 'gemini-2.5-flash',
      authToken: 'test-key',
      ...fastRetry,
    });

    expect(result).not.toBeNull();
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry on 401 (throw immediately)', async () => {
    mockedAxios.post.mockRejectedValueOnce(createAxiosError(401));

    // GeminiBaseProvider throws on error (doesn't return null)
    await expect(
      provider.callWithSystemMessage('Hello', 'Be helpful', {
        model: 'gemini-2.5-flash',
        authToken: 'test-key',
        ...fastRetry,
      })
    ).rejects.toThrow();

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should NOT retry on 400 (throw immediately)', async () => {
    mockedAxios.post.mockRejectedValueOnce(createAxiosError(400));

    await expect(
      provider.callWithSystemMessage('Hello', 'Be helpful', {
        model: 'gemini-2.5-flash',
        authToken: 'test-key',
        ...fastRetry,
      })
    ).rejects.toThrow();

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should exhaust all retries on persistent 429', async () => {
    mockedAxios.post.mockRejectedValue(createAxiosError(429));

    await expect(
      provider.callWithSystemMessage('Hello', 'Be helpful', {
        model: 'gemini-2.5-flash',
        authToken: 'test-key',
        ...fastRetry,
      })
    ).rejects.toThrow();

    // 1 initial + 2 retries = 3
    expect(mockedAxios.post).toHaveBeenCalledTimes(3);
  });

  it('should not retry when retry is disabled', async () => {
    mockedAxios.post.mockRejectedValueOnce(createAxiosError(429));

    await expect(
      provider.callWithSystemMessage('Hello', 'Be helpful', {
        model: 'gemini-2.5-flash',
        authToken: 'test-key',
        retry: { enabled: false },
      })
    ).rejects.toThrow();

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});

describe('AnthropicProvider - Retry Integration', () => {
  let provider: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { AnthropicProvider } = require('../../../../../src/middleware/services/llm/providers/anthropic-provider');
    provider = new AnthropicProvider();
  });

  it('should retry on 429 and succeed', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(createAxiosError(429))
      .mockResolvedValueOnce(createAnthropicResponse());

    const result = await provider.callWithSystemMessage('Hello', 'Be helpful', {
      authToken: 'test-key',
      model: 'claude-3-5-sonnet-20241022',
      ...fastRetry,
    });

    expect(result).not.toBeNull();
    expect(result!.message.content).toBe('Hello from Claude');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry on 401', async () => {
    mockedAxios.post.mockRejectedValueOnce(createAxiosError(401));

    // Anthropic returns null on error
    const result = await provider.callWithSystemMessage('Hello', 'Be helpful', {
      authToken: 'test-key',
      model: 'claude-3-5-sonnet-20241022',
      ...fastRetry,
    });

    expect(result).toBeNull();
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should retry on 500 server error', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(createAxiosError(500))
      .mockResolvedValueOnce(createAnthropicResponse());

    const result = await provider.callWithSystemMessage('Hello', 'Be helpful', {
      authToken: 'test-key',
      model: 'claude-3-5-sonnet-20241022',
      ...fastRetry,
    });

    expect(result).not.toBeNull();
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });
});

describe('RequestyProvider - Retry Integration', () => {
  let provider: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { RequestyProvider } = require('../../../../../src/middleware/services/llm/providers/requesty-provider');
    provider = new RequestyProvider();
  });

  it('should retry on 429 and succeed', async () => {
    mockedAxios.post
      .mockRejectedValueOnce(createAxiosError(429))
      .mockResolvedValueOnce(createRequestyResponse());

    const result = await provider.callWithSystemMessage('Hello', 'Be helpful', {
      authToken: 'test-key',
      model: 'openai/gpt-4o',
      ...fastRetry,
    });

    expect(result).not.toBeNull();
    expect(result!.message.content).toBe('Hello from Requesty');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry on 403', async () => {
    mockedAxios.post.mockRejectedValueOnce(createAxiosError(403));

    const result = await provider.callWithSystemMessage('Hello', 'Be helpful', {
      authToken: 'test-key',
      model: 'openai/gpt-4o',
      ...fastRetry,
    });

    expect(result).toBeNull();
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});
