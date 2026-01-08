/**
 * Manual Smoke Test for Reasoning Control Feature
 *
 * Tests the reasoningEffort parameter with Requesty + Gemini 3 Flash.
 * This is a quick manual test to verify the feature works.
 *
 * Usage:
 *   npm run test:reasoning:smoke
 *   # or directly:
 *   ts-node tests/manual/reasoning-smoke-test.ts
 *
 * Required environment variables:
 *   - REQUESTY_API_KEY: Your Requesty API key
 *
 * Optional environment variables:
 *   - TEST_REASONING_MODEL: Model to use (default: vertex/gemini-3-flash-preview)
 */

import * as dotenv from 'dotenv';
import { LLMService } from '../../src/middleware/services/llm/llm.service';
import { LLMProvider, ReasoningEffort } from '../../src/middleware/services/llm/types';

// Load environment variables
dotenv.config();

// Parse command line arguments: npm run test:reasoning:smoke -- [provider] [model]
// Examples:
//   npm run test:reasoning:smoke -- google gemini-3-flash-preview
//   npm run test:reasoning:smoke -- requesty google/gemini-2.5-flash
//   npm run test:reasoning:smoke  (uses defaults from .env)
const args = process.argv.slice(2);
const ARG_PROVIDER = args[0]?.toLowerCase();
const ARG_MODEL = args[1];

// Determine provider
const USE_DIRECT_GOOGLE = ARG_PROVIDER === 'google' || process.env.TEST_USE_DIRECT_GOOGLE === 'true';
const PROVIDER = USE_DIRECT_GOOGLE ? LLMProvider.GOOGLE : LLMProvider.REQUESTY;

// Determine model
const MODEL = ARG_MODEL || process.env.TEST_REASONING_MODEL || 'google/gemini-2.5-flash';

// Determine API key
const API_KEY = USE_DIRECT_GOOGLE ? process.env.GEMINI_API_KEY : process.env.REQUESTY_API_KEY;

// Test prompt - complex enough to see reasoning differences
const TEST_PROMPT = `A farmer has a rectangular field that measures 150 meters in length and 100 meters in width. He wants to build a fence around the entire field. how many meters of fencing material does he need to buy? Additionally, if he decides to divide the field into 3 equal smaller rectangular sections for different crops, what would be the area of each section in square meters?`;
const SYSTEM_MESSAGE = 'You are a helpful assistant.';


interface TestResult {
  reasoningEffort: ReasoningEffort;
  success: boolean;
  responsePreview: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd: number;
  processingTime: number;
  error?: string;
}

async function runReasoningTest(
  llmService: LLMService,
  reasoningEffort: ReasoningEffort
): Promise<TestResult> {
  const startTime = Date.now();

  // Use maximum tokens for all levels to see actual reasoning output without truncation
  // Gemini 3 Flash supports up to 65k output tokens
  const MAX_OUTPUT_TOKENS = 65536;

  try {
    const response = await llmService.callWithSystemMessage(
      TEST_PROMPT,
      SYSTEM_MESSAGE,
      {
        provider: PROVIDER,
        model: MODEL,
        authToken: API_KEY,
        reasoningEffort: reasoningEffort,
        maxTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
        debugContext: `reasoning-smoke-${reasoningEffort}`,
      }
    );

    if (!response) {
      return {
        reasoningEffort,
        success: false,
        responsePreview: '',
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        processingTime: Date.now() - startTime,
        error: 'Response was null',
      };
    }

    return {
      reasoningEffort,
      success: true,
      responsePreview: response.message.content.substring(0, 100),
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
      reasoningTokens: response.usage?.reasoningTokens ?? 0,
      totalTokens: response.usage?.totalTokens ?? 0,
      costUsd: response.usage?.costUsd ?? 0,
      processingTime: response.metadata?.processingTime ?? Date.now() - startTime,
    };
  } catch (error) {
    return {
      reasoningEffort,
      success: false,
      responsePreview: '',
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      processingTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('REASONING CONTROL SMOKE TEST');
  console.log('='.repeat(60));
  console.log();

  // Validate environment
  if (!API_KEY) {
    console.error('ERROR: REQUESTY_API_KEY is not set.');
    console.error('Please set it in your .env file.');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  Model: ${MODEL}`);
  console.log(`  Provider: ${USE_DIRECT_GOOGLE ? 'Google (Direct)' : 'Requesty'}`);
  console.log(`  API Key: ${API_KEY?.substring(0, 8) || 'NOT SET'}...`);
  console.log(`  Prompt: "${TEST_PROMPT}"`);
  console.log();

  const llmService = new LLMService();
  const efforts: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];
  const results: TestResult[] = [];

  console.log('Running tests...');
  console.log('-'.repeat(60));

  for (const effort of efforts) {
    console.log(`\nTesting reasoningEffort: ${effort}`);
    const result = await runReasoningTest(llmService, effort);
    results.push(result);

    if (result.success) {
      console.log(`  Status: SUCCESS`);
      console.log(`  Response: "${result.responsePreview}"`);
      console.log(`  Tokens: ${result.inputTokens} in / ${result.outputTokens} out / ${result.reasoningTokens} reasoning`);
      console.log(`  Total: ${result.totalTokens} tokens`);
      console.log(`  Cost: $${result.costUsd.toFixed(6)}`);
      console.log(`  Time: ${result.processingTime}ms`);
    } else {
      console.log(`  Status: FAILED`);
      console.log(`  Error: ${result.error}`);
    }
  }

  // Summary
  console.log();
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log();

  console.log('| Effort   | Status  | Out Tokens | Reasoning | Total     | Cost ($) | Time (ms) |');
  console.log('|----------|---------|------------|-----------|-----------|----------|-----------|');

  for (const result of results) {
    const status = result.success ? 'OK' : 'FAIL';
    console.log(
      `| ${result.reasoningEffort.padEnd(8)} | ${status.padEnd(7)} | ${result.outputTokens.toString().padStart(10)} | ${result.reasoningTokens.toString().padStart(9)} | ${result.totalTokens.toString().padStart(9)} | ${result.costUsd.toFixed(6).padStart(8)} | ${result.processingTime.toString().padStart(9)} |`
    );
  }

  console.log();

  // Comparison
  const noneResult = results.find(r => r.reasoningEffort === 'none');
  const highResult = results.find(r => r.reasoningEffort === 'high');

  if (noneResult?.success && highResult?.success) {
    const tokenDiff = highResult.outputTokens - noneResult.outputTokens;
    const tokenPct = noneResult.outputTokens > 0
      ? ((highResult.outputTokens / noneResult.outputTokens - 1) * 100).toFixed(1)
      : 'N/A';

    console.log('Comparison (none vs high):');
    console.log(`  Token difference: ${tokenDiff} tokens (${tokenPct}% more with high)`);
    console.log(`  Cost difference: $${(highResult.costUsd - noneResult.costUsd).toFixed(6)}`);
    console.log(`  Time difference: ${highResult.processingTime - noneResult.processingTime}ms`);
  }

  console.log();

  // Final status
  const allPassed = results.every(r => r.success);
  if (allPassed) {
    console.log('ALL TESTS PASSED!');
    console.log();
    const providerName = USE_DIRECT_GOOGLE ? 'Google (Direct API)' : 'Requesty';
    console.log(`The reasoningEffort parameter is working correctly with ${providerName} + ${MODEL}.`);
  } else {
    console.log('SOME TESTS FAILED!');
    console.log('Check the errors above for details.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
