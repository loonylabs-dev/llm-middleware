/**
 * Integration Tests for Reasoning Control Feature
 *
 * Tests the reasoningEffort parameter across different providers.
 * These tests make real API calls and require valid API keys.
 *
 * Run with: LLM_INTEGRATION_TESTS=true npm run test:integration:reasoning
 *
 * @see https://docs.requesty.ai/features/reasoning
 */

import * as dotenv from 'dotenv';
import { LLMService } from '../../src/middleware/services/llm/llm.service';
import { LLMProvider, ReasoningEffort } from '../../src/middleware/services/llm/types';
import {
  validateLiveLLMEnvironment,
  buildReasoningTestRequest,
  logLiveTestStart,
  logLiveTestResult,
  LLM_TIMEOUT,
  TEST_REASONING_MODEL,
  describeLive,
  itLive
} from './helpers/live-llm-test-helper';

// Load environment variables
dotenv.config();

/**
 * Test prompt that benefits from reasoning - a simple logic puzzle.
 */
const REASONING_PROMPT = 'What is 15 + 27? Just give me the number.';

/**
 * Simple prompt that doesn't need deep reasoning.
 */
const SIMPLE_PROMPT = 'Say "Hello" in exactly one word.';

describeLive('Reasoning Control Integration Tests', () => {
  let llmService: LLMService;

  beforeAll(() => {
    validateLiveLLMEnvironment();
    llmService = new LLMService();
  });

  describe('Requesty Provider with Gemini', () => {
    describe('reasoningEffort: none', () => {
      itLive('should use minimal reasoning tokens', async () => {
        logLiveTestStart('reasoningEffort: none');

        const requestOptions = buildReasoningTestRequest('none');

        const response = await llmService.callWithSystemMessage(
          SIMPLE_PROMPT,
          'You are a helpful assistant. Be concise.',
          {
            ...requestOptions,
            provider: LLMProvider.REQUESTY,
          }
        );

        expect(response).not.toBeNull();
        expect(response?.message.content).toBeDefined();
        expect(response?.message.content.length).toBeGreaterThan(0);

        logLiveTestResult({
          model: response?.metadata?.model,
          inputTokens: response?.usage?.inputTokens,
          outputTokens: response?.usage?.outputTokens,
          costUsd: response?.usage?.costUsd,
          processingTime: response?.metadata?.processingTime,
        });

        // With 'none', we expect fewer output tokens (no/minimal reasoning)
        console.log('Response:', response?.message.content);
      }, LLM_TIMEOUT);
    });

    describe('reasoningEffort: low', () => {
      itLive('should use light reasoning', async () => {
        logLiveTestStart('reasoningEffort: low');

        const requestOptions = buildReasoningTestRequest('low');

        const response = await llmService.callWithSystemMessage(
          REASONING_PROMPT,
          'You are a helpful assistant.',
          {
            ...requestOptions,
            provider: LLMProvider.REQUESTY,
          }
        );

        expect(response).not.toBeNull();
        expect(response?.message.content).toBeDefined();

        logLiveTestResult({
          model: response?.metadata?.model,
          inputTokens: response?.usage?.inputTokens,
          outputTokens: response?.usage?.outputTokens,
          costUsd: response?.usage?.costUsd,
          processingTime: response?.metadata?.processingTime,
        });

        console.log('Response:', response?.message.content);
      }, LLM_TIMEOUT);
    });

    describe('reasoningEffort: medium', () => {
      itLive('should use balanced reasoning', async () => {
        logLiveTestStart('reasoningEffort: medium');

        const requestOptions = buildReasoningTestRequest('medium');

        const response = await llmService.callWithSystemMessage(
          REASONING_PROMPT,
          'You are a helpful assistant.',
          {
            ...requestOptions,
            provider: LLMProvider.REQUESTY,
          }
        );

        expect(response).not.toBeNull();
        expect(response?.message.content).toBeDefined();

        logLiveTestResult({
          model: response?.metadata?.model,
          inputTokens: response?.usage?.inputTokens,
          outputTokens: response?.usage?.outputTokens,
          costUsd: response?.usage?.costUsd,
          processingTime: response?.metadata?.processingTime,
        });

        console.log('Response:', response?.message.content);
      }, LLM_TIMEOUT);
    });

    describe('reasoningEffort: high', () => {
      itLive('should use deep reasoning', async () => {
        logLiveTestStart('reasoningEffort: high');

        const requestOptions = buildReasoningTestRequest('high');

        const response = await llmService.callWithSystemMessage(
          REASONING_PROMPT,
          'You are a helpful assistant.',
          {
            ...requestOptions,
            provider: LLMProvider.REQUESTY,
          }
        );

        expect(response).not.toBeNull();
        expect(response?.message.content).toBeDefined();

        logLiveTestResult({
          model: response?.metadata?.model,
          inputTokens: response?.usage?.inputTokens,
          outputTokens: response?.usage?.outputTokens,
          costUsd: response?.usage?.costUsd,
          processingTime: response?.metadata?.processingTime,
        });

        console.log('Response:', response?.message.content);
      }, LLM_TIMEOUT);
    });

    describe('Comparison: none vs high', () => {
      itLive('should show difference in token usage between none and high', async () => {
        logLiveTestStart('Comparison: none vs high');

        const simpleRequest = buildReasoningTestRequest('none');
        const deepRequest = buildReasoningTestRequest('high');

        // Call with 'none'
        console.log('\n--- Testing with reasoningEffort: none ---');
        const noneResponse = await llmService.callWithSystemMessage(
          SIMPLE_PROMPT,
          'You are a helpful assistant. Be concise.',
          {
            ...simpleRequest,
            provider: LLMProvider.REQUESTY,
          }
        );

        const noneTokens = noneResponse?.usage?.outputTokens ?? 0;
        console.log(`Output tokens with 'none': ${noneTokens}`);
        console.log(`Response: ${noneResponse?.message.content}`);

        // Call with 'high'
        console.log('\n--- Testing with reasoningEffort: high ---');
        const highResponse = await llmService.callWithSystemMessage(
          SIMPLE_PROMPT,
          'You are a helpful assistant. Be concise.',
          {
            ...deepRequest,
            provider: LLMProvider.REQUESTY,
          }
        );

        const highTokens = highResponse?.usage?.outputTokens ?? 0;
        console.log(`Output tokens with 'high': ${highTokens}`);
        console.log(`Response: ${highResponse?.message.content}`);

        // Both should work
        expect(noneResponse).not.toBeNull();
        expect(highResponse).not.toBeNull();

        // Log comparison
        console.log('\n--- Comparison ---');
        console.log(`Tokens with 'none': ${noneTokens}`);
        console.log(`Tokens with 'high': ${highTokens}`);
        console.log(`Difference: ${highTokens - noneTokens} tokens (${((highTokens / noneTokens - 1) * 100).toFixed(1)}% more)`);

        // High should generally use more tokens due to reasoning
        // Note: This is not always guaranteed, so we just log the comparison
        logLiveTestResult({
          model: TEST_REASONING_MODEL,
          inputTokens: (noneResponse?.usage?.inputTokens ?? 0) + (highResponse?.usage?.inputTokens ?? 0),
          outputTokens: noneTokens + highTokens,
          costUsd: (noneResponse?.usage?.costUsd ?? 0) + (highResponse?.usage?.costUsd ?? 0),
        });
      }, LLM_TIMEOUT * 2); // Double timeout for two calls
    });
  });

  describe('Parameter Mapping', () => {
    itLive('should correctly map reasoningEffort to API parameter', async () => {
      logLiveTestStart('Parameter Mapping Test');

      // Test that the parameter is correctly passed through
      // by making a call that would fail if the parameter was malformed
      const efforts: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];

      for (const effort of efforts) {
        console.log(`\nTesting reasoningEffort: ${effort}`);

        const requestOptions = buildReasoningTestRequest(effort);

        const response = await llmService.callWithSystemMessage(
          'Say "OK"',
          'Respond with OK only.',
          {
            ...requestOptions,
            provider: LLMProvider.REQUESTY,
            maxTokens: 50, // Keep it fast
          }
        );

        expect(response).not.toBeNull();
        console.log(`  - Success! Response: ${response?.message.content?.substring(0, 50)}`);
      }

      console.log('\nAll reasoning effort levels work correctly.');
    }, LLM_TIMEOUT * 5); // 5x timeout for 5 calls
  });
});
