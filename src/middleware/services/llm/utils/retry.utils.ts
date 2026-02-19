/**
 * Retry utility with exponential backoff and jitter.
 *
 * Designed for LLM provider HTTP calls following Google's retry strategy:
 * https://cloud.google.com/storage/docs/retry-strategy
 *
 * Retryable conditions:
 * - HTTP 408 (Request Timeout)
 * - HTTP 429 (Too Many Requests)
 * - HTTP 5xx (Server Errors)
 * - Network errors (ECONNRESET, ETIMEDOUT, ECONNABORTED, etc.)
 *
 * Non-retryable:
 * - HTTP 400 (Bad Request)
 * - HTTP 401 (Unauthorized)
 * - HTTP 403 (Forbidden)
 * - Any other 4xx client errors
 */

import { logger } from '../../../shared/utils/logging.utils';

/** Configuration for retry behavior */
export interface RetryConfig {
  /** Enable/disable retry. Default: true */
  enabled?: boolean;
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries?: number;
  /** Initial delay in ms before first retry. Default: 1000 */
  initialDelayMs?: number;
  /** Multiplier applied to delay after each retry. Default: 2.0 */
  multiplier?: number;
  /** Maximum delay in ms between retries. Default: 30000 */
  maxDelayMs?: number;
  /** Enable jitter to randomize delays. Default: true */
  jitter?: boolean;
}

/** Default retry configuration following Google's recommendations */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  enabled: true,
  maxRetries: 3,
  initialDelayMs: 1000,
  multiplier: 2.0,
  maxDelayMs: 30000,
  jitter: true,
};

/** HTTP status codes that should trigger a retry */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/** Network error codes that should trigger a retry */
const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EPIPE',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
]);

/**
 * Checks if an error is retryable based on HTTP status or network error code.
 */
export function isRetryableError(error: any): boolean {
  // Axios error with HTTP response
  if (error?.isAxiosError && error.response) {
    return RETRYABLE_STATUS_CODES.has(error.response.status);
  }

  // Network/timeout errors (no response received)
  if (error?.isAxiosError && !error.response) {
    // Axios timeout
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return true;
    }
    // Other network errors
    if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) {
      return true;
    }
    return true; // Network errors without response are generally retryable
  }

  return false;
}

/**
 * Calculates the delay for a given retry attempt with optional jitter.
 */
export function calculateDelay(
  attempt: number,
  config: Required<RetryConfig>
): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.multiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  if (config.jitter) {
    // Full jitter: random value between 0 and cappedDelay
    return Math.random() * cappedDelay;
  }

  return cappedDelay;
}

/**
 * Extracts retry-relevant info from an error for logging.
 */
function getErrorInfo(error: any): { statusCode?: number; errorCode?: string; message: string } {
  if (error?.isAxiosError && error.response) {
    return {
      statusCode: error.response.status,
      message: error.response.statusText || error.message,
    };
  }
  return {
    errorCode: error?.code,
    message: error?.message || 'Unknown error',
  };
}

/**
 * Extracts the Retry-After header value in milliseconds.
 * Supports both integer (seconds) and HTTP-date formats.
 */
function getRetryAfterMs(error: any): number | undefined {
  const retryAfter = error?.response?.headers?.['retry-after'];
  if (!retryAfter) return undefined;

  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try HTTP-date format
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return undefined;
}

/**
 * Sleeps for the given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Options for retryWithBackoff beyond the retry config. */
export interface RetryHooks {
  /** Called before each retry. Use to adjust state (e.g., rotate regions on quota errors). */
  onRetry?: (error: any, attempt: number) => void;
}

/**
 * Executes an async function with exponential backoff retry on transient errors.
 *
 * @param fn - The async function to execute (typically an axios call)
 * @param context - Logging context (e.g. provider class name)
 * @param config - Retry configuration (merged with defaults)
 * @param hooks - Optional hooks (e.g., onRetry for region rotation)
 * @returns The result of fn()
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```ts
 * const response = await retryWithBackoff(
 *   () => axios.post(url, payload, axiosConfig),
 *   'GeminiDirectProvider',
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  context: string,
  config?: RetryConfig,
  hooks?: RetryHooks
): Promise<T> {
  const resolvedConfig: Required<RetryConfig> = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  if (!resolvedConfig.enabled) {
    return fn();
  }

  let lastError: any;

  for (let attempt = 0; attempt <= resolvedConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry if not retryable or last attempt
      if (!isRetryableError(error) || attempt === resolvedConfig.maxRetries) {
        throw error;
      }

      // Notify consumer before retry (e.g., for region rotation on quota errors)
      if (hooks?.onRetry) {
        hooks.onRetry(error, attempt + 1);
      }

      const errorInfo = getErrorInfo(error);
      let delayMs = calculateDelay(attempt, resolvedConfig);

      // Respect Retry-After header if present (use the larger value)
      const retryAfterMs = getRetryAfterMs(error);
      if (retryAfterMs !== undefined) {
        delayMs = Math.max(delayMs, retryAfterMs);
      }

      logger.warn(`Retrying request (attempt ${attempt + 1}/${resolvedConfig.maxRetries})`, {
        context,
        metadata: {
          attempt: attempt + 1,
          maxRetries: resolvedConfig.maxRetries,
          delayMs: Math.round(delayMs),
          statusCode: errorInfo.statusCode,
          errorCode: errorInfo.errorCode,
          error: errorInfo.message,
          ...(retryAfterMs !== undefined && { retryAfterMs }),
        },
      });

      await sleep(delayMs);
    }
  }

  // Should not reach here, but safety net
  throw lastError;
}
