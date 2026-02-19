/**
 * VertexAI Region Rotation Tests
 *
 * Tests the opt-in region rotation feature for quota errors (429 / Resource Exhausted).
 * Mirrors the production-proven pattern from @loonylabs/tti-middleware.
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

// Mock google-auth-library to avoid real auth
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn(),
  JWT: jest.fn().mockImplementation(() => ({
    getAccessToken: jest.fn().mockResolvedValue({ token: 'mock-token' }),
  })),
}));

import { VertexAIProvider, VertexAIProviderConfig } from '../../../../../src/middleware/services/llm/providers/gemini/vertex-ai.provider';
import { RegionRotationConfig } from '../../../../../src/middleware/services/llm/types/vertex-ai.types';

/**
 * Creates a mock Axios error with given status.
 */
function createAxiosError(status: number, message?: string) {
  const error: any = new Error(message || `Request failed with status code ${status}`);
  error.isAxiosError = true;
  error.response = {
    status,
    statusText: `Status ${status}`,
    headers: {},
    data: { error: 'test error' },
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

// Fast retry config to avoid slow tests
const fastRetry = {
  enabled: true,
  maxRetries: 5,
  initialDelayMs: 1,
  multiplier: 1,
  maxDelayMs: 2,
  jitter: false,
};

const defaultRegionRotation: RegionRotationConfig = {
  regions: ['europe-west3', 'europe-west1', 'europe-west4'],
  fallback: 'global',
  alwaysTryFallback: true,
};

const baseOptions = {
  model: 'gemini-2.5-flash',
  projectId: 'test-project',
  serviceAccountKey: {
    client_email: 'test@test.iam.gserviceaccount.com',
    private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA2a2rwplBQLOFhvP0KBkg\n-----END RSA PRIVATE KEY-----\n',
  },
  retry: fastRetry,
};

/**
 * Extracts the region from a Vertex AI endpoint URL.
 * URL format: https://{region}-aiplatform.googleapis.com/...
 * Global format: https://aiplatform.googleapis.com/...
 */
function extractRegionFromUrl(url: string): string {
  const match = url.match(/https:\/\/(.+)-aiplatform\.googleapis\.com/);
  if (match) return match[1];
  if (url.includes('aiplatform.googleapis.com')) return 'global';
  return 'unknown';
}

describe('VertexAI Region Rotation', () => {
  let provider: VertexAIProvider;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('config validation', () => {
    it('should accept valid regionRotation config', () => {
      expect(() => new VertexAIProvider({
        regionRotation: defaultRegionRotation,
      })).not.toThrow();
    });

    it('should throw when regions array is empty', () => {
      expect(() => new VertexAIProvider({
        regionRotation: {
          regions: [],
          fallback: 'global',
        },
      })).toThrow('regionRotation.regions must contain at least one region');
    });

    it('should throw when fallback is missing', () => {
      expect(() => new VertexAIProvider({
        regionRotation: {
          regions: ['europe-west3'],
          fallback: '' as any,
        },
      })).toThrow('regionRotation.fallback is required');
    });

    it('should work without regionRotation (backwards compatible)', () => {
      expect(() => new VertexAIProvider()).not.toThrow();
      expect(() => new VertexAIProvider({})).not.toThrow();
      expect(() => new VertexAIProvider(undefined)).not.toThrow();
    });

    it('should default alwaysTryFallback to true (implicitly)', () => {
      // Config without alwaysTryFallback should work and default to true behavior
      const config: RegionRotationConfig = {
        regions: ['europe-west3'],
        fallback: 'global',
      };
      expect(() => new VertexAIProvider({ regionRotation: config })).not.toThrow();
    });
  });

  describe('regions shorter than retries (regions=3, maxRetries=5)', () => {
    // Sequence: ew3 → ew1 → ew4 → global → global → global (6 total)
    // 3 regions + fallback = 4 entries in sequence, retries=5 gives 6 total attempts

    beforeEach(() => {
      provider = new VertexAIProvider({
        regionRotation: defaultRegionRotation,
      });
    });

    it('should rotate through all regions then stay on fallback', async () => {
      const calledUrls: string[] = [];
      mockedAxios.post.mockImplementation(async (url: string) => {
        calledUrls.push(url);
        throw createAxiosError(429);
      });

      await expect(
        provider.callWithSystemMessage('Hello', 'Be helpful', baseOptions)
      ).rejects.toThrow();

      const calledRegions = calledUrls.map(extractRegionFromUrl);

      // 1 initial + 5 retries = 6 attempts
      // Sequence: ew3 → ew1 → ew4 → global → global → global
      expect(calledRegions[0]).toBe('europe-west3');
      expect(calledRegions[1]).toBe('europe-west1');
      expect(calledRegions[2]).toBe('europe-west4');
      expect(calledRegions[3]).toBe('global');
      // Remaining attempts stay on fallback (last in sequence)
      expect(calledRegions[4]).toBe('global');
      expect(calledRegions[5]).toBe('global');

      // No bonus fallback because already reached fallback during retries
      // Total: 6 attempts (not 7)
      expect(calledUrls).toHaveLength(6);
    });

    it('should succeed when a rotated region works', async () => {
      let callCount = 0;
      mockedAxios.post.mockImplementation(async (url: string) => {
        callCount++;
        const region = extractRegionFromUrl(url);
        if (region === 'europe-west1') {
          return createGeminiResponse();
        }
        throw createAxiosError(429);
      });

      const result = await provider.callWithSystemMessage('Hello', 'Be helpful', baseOptions);

      expect(result).not.toBeNull();
      expect(result!.message.content).toBe('Hello from Gemini');
      // 1st attempt (ew3) fails, 2nd attempt (ew1) succeeds
      expect(callCount).toBe(2);
    });
  });

  describe('regions longer than retries (regions=5, maxRetries=3)', () => {
    const manyRegions: RegionRotationConfig = {
      regions: ['europe-west3', 'europe-west1', 'europe-west4', 'europe-north1', 'europe-central2'],
      fallback: 'global',
      alwaysTryFallback: true,
    };

    it('should exhaust budget then try fallback as bonus (alwaysTryFallback=true)', async () => {
      const calledUrls: string[] = [];
      mockedAxios.post.mockImplementation(async (url: string) => {
        calledUrls.push(url);
        throw createAxiosError(429);
      });

      provider = new VertexAIProvider({ regionRotation: manyRegions });

      await expect(
        provider.callWithSystemMessage('Hello', 'Be helpful', {
          ...baseOptions,
          retry: { ...fastRetry, maxRetries: 3 },
        })
      ).rejects.toThrow();

      const calledRegions = calledUrls.map(extractRegionFromUrl);

      // 1 initial + 3 retries = 4 attempts during normal retry
      // Sequence: ew3 → ew1 → ew4 → en1
      // Then bonus attempt on global
      expect(calledRegions[0]).toBe('europe-west3');
      expect(calledRegions[1]).toBe('europe-west1');
      expect(calledRegions[2]).toBe('europe-west4');
      expect(calledRegions[3]).toBe('europe-north1');
      // Bonus fallback attempt
      expect(calledRegions[4]).toBe('global');
      expect(calledUrls).toHaveLength(5);
    });

    it('should NOT try fallback bonus when alwaysTryFallback=false', async () => {
      const calledUrls: string[] = [];
      mockedAxios.post.mockImplementation(async (url: string) => {
        calledUrls.push(url);
        throw createAxiosError(429);
      });

      const noFallbackConfig: RegionRotationConfig = {
        ...manyRegions,
        alwaysTryFallback: false,
      };
      provider = new VertexAIProvider({ regionRotation: noFallbackConfig });

      await expect(
        provider.callWithSystemMessage('Hello', 'Be helpful', {
          ...baseOptions,
          retry: { ...fastRetry, maxRetries: 3 },
        })
      ).rejects.toThrow();

      // 1 initial + 3 retries = 4 attempts, NO bonus
      expect(calledUrls).toHaveLength(4);
    });

    it('should succeed on fallback bonus attempt', async () => {
      const calledUrls: string[] = [];
      mockedAxios.post.mockImplementation(async (url: string) => {
        calledUrls.push(url);
        const region = extractRegionFromUrl(url);
        if (region === 'global') {
          return createGeminiResponse();
        }
        throw createAxiosError(429);
      });

      provider = new VertexAIProvider({ regionRotation: manyRegions });

      const result = await provider.callWithSystemMessage('Hello', 'Be helpful', {
        ...baseOptions,
        retry: { ...fastRetry, maxRetries: 3 },
      });

      expect(result).not.toBeNull();
      expect(result!.message.content).toBe('Hello from Gemini');
      // 4 normal attempts + 1 bonus = 5
      expect(calledUrls).toHaveLength(5);
      expect(extractRegionFromUrl(calledUrls[4])).toBe('global');
    });

    it('should NOT try fallback bonus if already reached fallback during retries', async () => {
      const calledUrls: string[] = [];
      mockedAxios.post.mockImplementation(async (url: string) => {
        calledUrls.push(url);
        throw createAxiosError(429);
      });

      // Only 2 regions + fallback: sequence = [ew3, ew1, global]
      // With maxRetries=5, we'll reach global before budget is exhausted
      const shortConfig: RegionRotationConfig = {
        regions: ['europe-west3', 'europe-west1'],
        fallback: 'global',
        alwaysTryFallback: true,
      };
      provider = new VertexAIProvider({ regionRotation: shortConfig });

      await expect(
        provider.callWithSystemMessage('Hello', 'Be helpful', {
          ...baseOptions,
          retry: { ...fastRetry, maxRetries: 5 },
        })
      ).rejects.toThrow();

      const calledRegions = calledUrls.map(extractRegionFromUrl);

      // Already reached global during retries → no bonus attempt
      // 1 initial + 5 retries = 6 attempts
      expect(calledUrls).toHaveLength(6);
      // Last region should be global (reached during normal retries)
      expect(calledRegions[calledRegions.length - 1]).toBe('global');
    });
  });

  describe('no regionRotation configured', () => {
    it('should retry on same region (existing behavior, backwards compatible)', async () => {
      const calledUrls: string[] = [];
      mockedAxios.post.mockImplementation(async (url: string) => {
        calledUrls.push(url);
        throw createAxiosError(429);
      });

      provider = new VertexAIProvider(); // No config

      await expect(
        provider.callWithSystemMessage('Hello', 'Be helpful', {
          ...baseOptions,
          region: 'europe-west3',
          retry: { ...fastRetry, maxRetries: 2 },
        })
      ).rejects.toThrow();

      const calledRegions = calledUrls.map(extractRegionFromUrl);

      // All attempts on the same region
      expect(calledRegions.every(r => r === 'europe-west3')).toBe(true);
      // 1 initial + 2 retries = 3 attempts
      expect(calledUrls).toHaveLength(3);
    });
  });

  describe('non-quota errors', () => {
    beforeEach(() => {
      provider = new VertexAIProvider({
        regionRotation: defaultRegionRotation,
      });
    });

    it('should NOT rotate on 500 server errors', async () => {
      const calledUrls: string[] = [];
      mockedAxios.post.mockImplementation(async (url: string) => {
        calledUrls.push(url);
        throw createAxiosError(500);
      });

      await expect(
        provider.callWithSystemMessage('Hello', 'Be helpful', {
          ...baseOptions,
          retry: { ...fastRetry, maxRetries: 2 },
        })
      ).rejects.toThrow();

      const calledRegions = calledUrls.map(extractRegionFromUrl);

      // All attempts on the same region (500 is retryable but not quota)
      expect(calledRegions.every(r => r === 'europe-west3')).toBe(true);
      expect(calledUrls).toHaveLength(3);
    });

    it('should rotate on quota errors but not on server errors (mixed)', async () => {
      const calledUrls: string[] = [];
      let callCount = 0;
      mockedAxios.post.mockImplementation(async (url: string) => {
        calledUrls.push(url);
        callCount++;
        if (callCount === 1) throw createAxiosError(429); // Quota → rotate
        if (callCount === 2) throw createAxiosError(500); // Server → stay
        if (callCount === 3) throw createAxiosError(429); // Quota → rotate
        return createGeminiResponse();
      });

      const result = await provider.callWithSystemMessage('Hello', 'Be helpful', baseOptions);

      const calledRegions = calledUrls.map(extractRegionFromUrl);

      expect(result).not.toBeNull();
      expect(calledRegions[0]).toBe('europe-west3'); // Initial
      expect(calledRegions[1]).toBe('europe-west1'); // Rotated after 429
      expect(calledRegions[2]).toBe('europe-west1'); // Stayed after 500
      expect(calledRegions[3]).toBe('europe-west4'); // Rotated after 429
    });
  });

  describe('quota error detection', () => {
    beforeEach(() => {
      provider = new VertexAIProvider({
        regionRotation: defaultRegionRotation,
      });
    });

    it.each([
      ['429 Too Many Requests', createAxiosError(429)],
      ['Resource Exhausted', (() => { const e: any = new Error('Resource Exhausted'); e.isAxiosError = true; e.response = { status: 429, headers: {}, data: {} }; return e; })()],
      ['Quota exceeded', (() => { const e: any = new Error('Quota exceeded for quota metric'); e.isAxiosError = true; e.response = { status: 429, headers: {}, data: {} }; return e; })()],
      ['Rate limit exceeded', (() => { const e: any = new Error('Rate limit exceeded'); e.isAxiosError = true; e.response = { status: 429, headers: {}, data: {} }; return e; })()],
      ['Too many requests', (() => { const e: any = new Error('Too many requests'); e.isAxiosError = true; e.response = { status: 429, headers: {}, data: {} }; return e; })()],
    ])('should rotate on "%s"', async (_label, quotaError) => {
      const calledUrls: string[] = [];
      let callCount = 0;
      mockedAxios.post.mockImplementation(async (url: string) => {
        calledUrls.push(url);
        callCount++;
        if (callCount === 1) throw quotaError;
        return createGeminiResponse();
      });

      const result = await provider.callWithSystemMessage('Hello', 'Be helpful', baseOptions);

      expect(result).not.toBeNull();
      const calledRegions = calledUrls.map(extractRegionFromUrl);
      // Should have rotated: first region → second region
      expect(calledRegions[0]).toBe('europe-west3');
      expect(calledRegions[1]).toBe('europe-west1');
    });
  });

  describe('preview models', () => {
    it('should skip rotation for preview models (they use global)', async () => {
      provider = new VertexAIProvider({
        regionRotation: defaultRegionRotation,
      });

      const calledUrls: string[] = [];
      mockedAxios.post.mockImplementation(async (url: string) => {
        calledUrls.push(url);
        throw createAxiosError(429);
      });

      await expect(
        provider.callWithSystemMessage('Hello', 'Be helpful', {
          ...baseOptions,
          model: 'gemini-3-flash-preview',
          retry: { ...fastRetry, maxRetries: 2 },
        })
      ).rejects.toThrow();

      // All attempts should use global (preview model)
      const calledRegions = calledUrls.map(extractRegionFromUrl);
      expect(calledRegions.every(r => r === 'global')).toBe(true);
    });
  });
});
