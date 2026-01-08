/**
 * Live LLM Test Helper
 * Utilities for integration tests that make real LLM API calls.
 *
 * Pattern inspired by scribomate-nextjs test infrastructure.
 *
 * @example
 * ```typescript
 * import { validateLiveLLMEnvironment, buildLiveTestRequest, TEST_MODEL } from './helpers/live-llm-test-helper';
 *
 * beforeAll(() => {
 *   validateLiveLLMEnvironment();
 * });
 *
 * it('should call LLM', async () => {
 *   const request = buildLiveTestRequest({
 *     prompt: 'Hello',
 *   });
 *   // request now has model and provider set
 * });
 * ```
 */

import * as dotenv from 'dotenv';
import { LLMProvider } from '../../../src/middleware/services/llm/types';
import type { ReasoningEffort } from '../../../src/middleware/services/llm/types';

// Load environment variables
dotenv.config();

/**
 * Default test model - uses a fast, cost-effective model for testing.
 * Uses Gemini Flash via Requesty for good balance of speed and capability.
 */
export const TEST_MODEL = process.env.TEST_LLM_MODEL || 'vertex/gemini-2.0-flash-lite';

/**
 * Default test provider - Requesty provides unified access to multiple providers.
 */
export const TEST_PROVIDER = LLMProvider.REQUESTY;

/**
 * Reasoning test model - model with reasoning/thinking capabilities.
 * Gemini 3 Flash is used for testing reasoning_effort parameter.
 */
export const TEST_REASONING_MODEL = process.env.TEST_REASONING_MODEL || 'vertex/gemini-3-flash-preview';

/**
 * Default timeout for LLM calls in milliseconds.
 */
export const LLM_TIMEOUT = 60000; // 60 seconds

/**
 * Required environment variables for live LLM tests.
 */
const REQUIRED_ENV_VARS = ['REQUESTY_API_KEY'];

/**
 * Optional but recommended environment variables.
 */
const OPTIONAL_ENV_VARS = ['DEBUG_LLM_REQUESTS', 'TEST_LLM_MODEL', 'TEST_REASONING_MODEL'];

/**
 * Validates that all required environment variables are set.
 * Call this in beforeAll() for live LLM tests.
 *
 * @throws Error if required environment variables are missing
 */
export function validateLiveLLMEnvironment(): void {
  const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables for live LLM tests: ${missingVars.join(', ')}\n` +
      `Please set these in your .env file:\n` +
      missingVars.map(v => `  ${v}=your_value_here`).join('\n')
    );
  }

  // Log configuration for debugging
  console.log('\n=== Live LLM Test Environment ===');
  console.log(`Provider: ${TEST_PROVIDER}`);
  console.log(`Model: ${TEST_MODEL}`);
  console.log(`Reasoning Model: ${TEST_REASONING_MODEL}`);
  console.log(`API Key configured: ${!!process.env.REQUESTY_API_KEY}`);
  console.log(`Debug logging: ${process.env.DEBUG_LLM_REQUESTS === 'true' ? 'enabled' : 'disabled'}`);
  console.log('================================\n');
}

/**
 * Checks if live LLM tests should run.
 * Tests are skipped if LLM_INTEGRATION_TESTS environment variable is not 'true'.
 *
 * @returns true if live tests should run
 */
export function shouldRunLiveTests(): boolean {
  return process.env.LLM_INTEGRATION_TESTS === 'true';
}

/**
 * Options for building a live test request.
 */
export interface LiveTestRequestOptions {
  /** Override the default model */
  model?: string;
  /** Override the default provider */
  provider?: LLMProvider;
  /** Temperature for generation (0-1) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Reasoning effort level for reasoning models */
  reasoningEffort?: ReasoningEffort;
  /** Debug context for logging */
  debugContext?: string;
}

/**
 * Builds a request object with default test configuration.
 * Use this to create requests for live LLM tests.
 *
 * @param options - Optional overrides for default configuration
 * @returns Request options ready for LLMService
 */
export function buildLiveTestRequest(options: LiveTestRequestOptions = {}): {
  model: string;
  provider: LLMProvider;
  authToken: string | undefined;
  temperature: number;
  maxTokens: number;
  reasoningEffort?: ReasoningEffort;
  debugContext: string;
} {
  return {
    model: options.model ?? TEST_MODEL,
    provider: options.provider ?? TEST_PROVIDER,
    authToken: process.env.REQUESTY_API_KEY,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 1024,
    ...(options.reasoningEffort && { reasoningEffort: options.reasoningEffort }),
    debugContext: options.debugContext ?? 'live-llm-test',
  };
}

/**
 * Builds a request for testing reasoning models.
 *
 * @param reasoningEffort - The reasoning effort level to use
 * @param options - Optional additional overrides
 * @returns Request options configured for reasoning model testing
 */
export function buildReasoningTestRequest(
  reasoningEffort: ReasoningEffort,
  options: Omit<LiveTestRequestOptions, 'reasoningEffort'> = {}
): ReturnType<typeof buildLiveTestRequest> {
  return buildLiveTestRequest({
    model: TEST_REASONING_MODEL,
    reasoningEffort,
    debugContext: `reasoning-test-${reasoningEffort}`,
    ...options,
  });
}

/**
 * Logs the start of a live LLM test for visibility.
 *
 * @param testName - Name of the test being run
 */
export function logLiveTestStart(testName: string): void {
  console.log(`\n>>> Starting live LLM test: ${testName}`);
  console.log(`    Time: ${new Date().toISOString()}`);
}

/**
 * Logs the result of a live LLM test.
 *
 * @param result - The test result containing token usage and other metadata
 */
export function logLiveTestResult(result: {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
  processingTime?: number;
}): void {
  console.log(`\n<<< Live LLM test completed`);
  if (result.model) console.log(`    Model: ${result.model}`);
  if (result.inputTokens !== undefined) console.log(`    Input tokens: ${result.inputTokens}`);
  if (result.outputTokens !== undefined) console.log(`    Output tokens: ${result.outputTokens}`);
  if (result.reasoningTokens !== undefined) console.log(`    Reasoning tokens: ${result.reasoningTokens}`);
  if (result.costUsd !== undefined) console.log(`    Cost: $${result.costUsd.toFixed(6)}`);
  if (result.processingTime !== undefined) console.log(`    Processing time: ${result.processingTime}ms`);
  console.log('');
}

/**
 * Wrapper for conditional test execution.
 * Use this to skip tests when live LLM testing is disabled.
 *
 * @example
 * ```typescript
 * describeLive('Live LLM Tests', () => {
 *   it('should call LLM', async () => {
 *     // This test only runs when LLM_INTEGRATION_TESTS=true
 *   });
 * });
 * ```
 */
export const describeLive = shouldRunLiveTests() ? describe : describe.skip;

/**
 * Wrapper for conditional individual test execution.
 */
export const itLive = shouldRunLiveTests() ? it : it.skip;
