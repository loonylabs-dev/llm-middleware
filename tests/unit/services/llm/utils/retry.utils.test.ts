import {
  retryWithBackoff,
  isRetryableError,
  isQuotaError,
  calculateDelay,
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
} from '../../../../../src/middleware/services/llm/utils/retry.utils';

// Mock the logger to avoid console output in tests
jest.mock('../../../../../src/middleware/shared/utils/logging.utils', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

/**
 * Creates a mock Axios error for testing.
 */
function createAxiosError(status?: number, code?: string, headers?: Record<string, string>) {
  const error: any = new Error(`Request failed with status code ${status || 'unknown'}`);
  error.isAxiosError = true;
  error.code = code;
  if (status) {
    error.response = {
      status,
      statusText: `Status ${status}`,
      headers: headers || {},
      data: { error: 'test error' },
    };
  }
  return error;
}

describe('isRetryableError', () => {
  it('should return true for 429 (Too Many Requests)', () => {
    expect(isRetryableError(createAxiosError(429))).toBe(true);
  });

  it('should return true for 408 (Request Timeout)', () => {
    expect(isRetryableError(createAxiosError(408))).toBe(true);
  });

  it.each([500, 502, 503, 504])('should return true for %d server error', (status) => {
    expect(isRetryableError(createAxiosError(status))).toBe(true);
  });

  it('should return false for 400 (Bad Request)', () => {
    expect(isRetryableError(createAxiosError(400))).toBe(false);
  });

  it('should return false for 401 (Unauthorized)', () => {
    expect(isRetryableError(createAxiosError(401))).toBe(false);
  });

  it('should return false for 403 (Forbidden)', () => {
    expect(isRetryableError(createAxiosError(403))).toBe(false);
  });

  it('should return true for network errors (no response)', () => {
    const error: any = new Error('Network Error');
    error.isAxiosError = true;
    error.code = 'ECONNRESET';
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for timeout errors', () => {
    const error: any = new Error('timeout of 180000ms exceeded');
    error.isAxiosError = true;
    error.code = 'ECONNABORTED';
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for non-axios errors', () => {
    expect(isRetryableError(new Error('some error'))).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe('isQuotaError', () => {
  it('should return true for 429 axios error', () => {
    expect(isQuotaError(createAxiosError(429))).toBe(true);
  });

  it('should return false for 500 server error', () => {
    expect(isQuotaError(createAxiosError(500))).toBe(false);
  });

  it('should return false for 503 server error', () => {
    expect(isQuotaError(createAxiosError(503))).toBe(false);
  });

  it('should return false for 400 client error', () => {
    expect(isQuotaError(createAxiosError(400))).toBe(false);
  });

  it('should detect "resource exhausted" in error message', () => {
    const error = new Error('Resource Exhausted');
    expect(isQuotaError(error)).toBe(true);
  });

  it('should detect "quota exceeded" in error message', () => {
    const error = new Error('Quota exceeded for quota metric');
    expect(isQuotaError(error)).toBe(true);
  });

  it('should detect "rate limit" in error message', () => {
    const error = new Error('Rate limit exceeded');
    expect(isQuotaError(error)).toBe(true);
  });

  it('should detect "too many requests" in error message', () => {
    const error = new Error('Too many requests');
    expect(isQuotaError(error)).toBe(true);
  });

  it('should detect "429" in error message (non-axios)', () => {
    const error = new Error('HTTP 429: Too many requests');
    expect(isQuotaError(error)).toBe(true);
  });

  it('should return false for non-quota errors', () => {
    expect(isQuotaError(new Error('some random error'))).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});

describe('calculateDelay', () => {
  const configNoJitter: Required<RetryConfig> = {
    ...DEFAULT_RETRY_CONFIG,
    jitter: false,
  };

  it('should calculate exponential delays without jitter', () => {
    expect(calculateDelay(0, configNoJitter)).toBe(1000);  // 1000 * 2^0
    expect(calculateDelay(1, configNoJitter)).toBe(2000);  // 1000 * 2^1
    expect(calculateDelay(2, configNoJitter)).toBe(4000);  // 1000 * 2^2
    expect(calculateDelay(3, configNoJitter)).toBe(8000);  // 1000 * 2^3
  });

  it('should cap at maxDelayMs', () => {
    expect(calculateDelay(10, configNoJitter)).toBe(30000); // capped
  });

  it('should apply jitter (result between 0 and cappedDelay)', () => {
    const configWithJitter: Required<RetryConfig> = {
      ...DEFAULT_RETRY_CONFIG,
      jitter: true,
    };

    // Run multiple times to verify randomness stays in bounds
    for (let i = 0; i < 50; i++) {
      const delay = calculateDelay(0, configWithJitter);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1000);
    }
  });
});

describe('retryWithBackoff', () => {
  // Speed up tests by using minimal delays
  const fastConfig: RetryConfig = {
    enabled: true,
    maxRetries: 3,
    initialDelayMs: 1,
    multiplier: 1,
    maxDelayMs: 5,
    jitter: false,
  };

  it('should return result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn, 'test', fastConfig);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error and succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(createAxiosError(429))
      .mockResolvedValue('success after retry');

    const result = await retryWithBackoff(fn, 'test', fastConfig);
    expect(result).toBe('success after retry');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry up to maxRetries times', async () => {
    const fn = jest.fn().mockRejectedValue(createAxiosError(503));

    await expect(retryWithBackoff(fn, 'test', fastConfig)).rejects.toThrow();
    // 1 initial + 3 retries = 4 calls
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('should not retry non-retryable errors (400)', async () => {
    const fn = jest.fn().mockRejectedValue(createAxiosError(400));

    await expect(retryWithBackoff(fn, 'test', fastConfig)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should not retry non-retryable errors (401)', async () => {
    const fn = jest.fn().mockRejectedValue(createAxiosError(401));

    await expect(retryWithBackoff(fn, 'test', fastConfig)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should not retry when disabled', async () => {
    const fn = jest.fn().mockRejectedValue(createAxiosError(429));

    await expect(
      retryWithBackoff(fn, 'test', { ...fastConfig, enabled: false })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should respect Retry-After header (integer seconds)', async () => {
    const error = createAxiosError(429, undefined, { 'retry-after': '1' });
    const fn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('ok');

    const start = Date.now();
    await retryWithBackoff(fn, 'test', {
      ...fastConfig,
      initialDelayMs: 1,
    });
    // Retry-After: 1 = 1000ms, should take at least ~900ms (allow some tolerance)
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(800);
  }, 10000);

  it('should retry network errors', async () => {
    const networkError: any = new Error('Network Error');
    networkError.isAxiosError = true;
    networkError.code = 'ECONNRESET';

    const fn = jest.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue('recovered');

    const result = await retryWithBackoff(fn, 'test', fastConfig);
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should apply exponentially increasing delays between retries', async () => {
    const callTimestamps: number[] = [];
    const fn = jest.fn().mockImplementation(() => {
      callTimestamps.push(Date.now());
      return Promise.reject(createAxiosError(429));
    });

    const config: RetryConfig = {
      enabled: true,
      maxRetries: 3,
      initialDelayMs: 100,  // 100ms base
      multiplier: 2.0,
      maxDelayMs: 5000,
      jitter: false,        // no jitter so delays are deterministic
    };

    await expect(retryWithBackoff(fn, 'test', config)).rejects.toThrow();
    expect(callTimestamps).toHaveLength(4); // 1 initial + 3 retries

    // Measure actual gaps between calls
    const gaps = [];
    for (let i = 1; i < callTimestamps.length; i++) {
      gaps.push(callTimestamps[i] - callTimestamps[i - 1]);
    }

    // Expected delays (no jitter): 100ms, 200ms, 400ms
    // Allow 50ms tolerance for timer precision
    expect(gaps[0]).toBeGreaterThanOrEqual(80);   // ~100ms
    expect(gaps[0]).toBeLessThan(200);
    expect(gaps[1]).toBeGreaterThanOrEqual(160);  // ~200ms
    expect(gaps[1]).toBeLessThan(350);
    expect(gaps[2]).toBeGreaterThanOrEqual(350);  // ~400ms
    expect(gaps[2]).toBeLessThan(600);

    // Verify each gap is larger than the previous (exponential growth)
    expect(gaps[1]).toBeGreaterThan(gaps[0]);
    expect(gaps[2]).toBeGreaterThan(gaps[1]);
  }, 10000);

  it('should cap delay at maxDelayMs', async () => {
    const callTimestamps: number[] = [];
    const fn = jest.fn().mockImplementation(() => {
      callTimestamps.push(Date.now());
      return Promise.reject(createAxiosError(503));
    });

    const config: RetryConfig = {
      enabled: true,
      maxRetries: 2,
      initialDelayMs: 200,
      multiplier: 10.0,    // aggressive multiplier
      maxDelayMs: 300,     // but capped at 300ms
      jitter: false,
    };

    await expect(retryWithBackoff(fn, 'test', config)).rejects.toThrow();
    expect(callTimestamps).toHaveLength(3);

    const gaps = [];
    for (let i = 1; i < callTimestamps.length; i++) {
      gaps.push(callTimestamps[i] - callTimestamps[i - 1]);
    }

    // First delay: 200ms (200 * 10^0 = 200, capped at 300 → 200)
    // Second delay: 300ms (200 * 10^1 = 2000, capped at 300)
    // Both should be under maxDelayMs + tolerance
    expect(gaps[0]).toBeGreaterThanOrEqual(150);
    expect(gaps[1]).toBeGreaterThanOrEqual(250);
    expect(gaps[1]).toBeLessThan(500); // should not exceed cap + tolerance
  }, 10000);

  it('should preserve the original error on final failure', async () => {
    const originalError = createAxiosError(503);
    const fn = jest.fn().mockRejectedValue(originalError);

    try {
      await retryWithBackoff(fn, 'test', fastConfig);
      fail('Should have thrown');
    } catch (error: any) {
      expect(error).toBe(originalError);
      expect(error.response.status).toBe(503);
    }
  });

  describe('onRetry hook', () => {
    it('should call onRetry on each retryable error', async () => {
      const onRetry = jest.fn();
      const fn = jest.fn().mockRejectedValue(createAxiosError(429));

      await expect(
        retryWithBackoff(fn, 'test', { ...fastConfig, maxRetries: 3 }, { onRetry })
      ).rejects.toThrow();

      // 3 retries → 3 onRetry calls (attempts 1, 2, 3)
      expect(onRetry).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1);
      expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
      expect(onRetry).toHaveBeenNthCalledWith(3, expect.any(Error), 3);
    });

    it('should NOT call onRetry for non-retryable errors', async () => {
      const onRetry = jest.fn();
      const fn = jest.fn().mockRejectedValue(createAxiosError(400));

      await expect(
        retryWithBackoff(fn, 'test', fastConfig, { onRetry })
      ).rejects.toThrow();

      expect(onRetry).not.toHaveBeenCalled();
    });

    it('should NOT call onRetry when budget is exhausted (last error throws directly)', async () => {
      const onRetry = jest.fn();
      const fn = jest.fn().mockRejectedValue(createAxiosError(429));

      await expect(
        retryWithBackoff(fn, 'test', { ...fastConfig, maxRetries: 2 }, { onRetry })
      ).rejects.toThrow();

      // 2 retries → 2 onRetry calls (NOT 3 — budget exhausted on 3rd failure)
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('should work without onRetry (backwards compatible)', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(createAxiosError(429))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn, 'test', fastConfig);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should work with undefined hooks parameter', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(createAxiosError(429))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn, 'test', fastConfig, undefined);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
