/**
 * Manual Smoke Test for Vertex AI Provider
 *
 * Tests the Vertex AI provider with Service Account authentication
 * and reasoning control (thinkingBudget for 2.5, thinkingLevel for 3.x).
 *
 * Usage:
 *   npm run test:vertex:smoke
 *   # or directly:
 *   ts-node tests/manual/vertex-ai-smoke-test.ts
 *   # with specific model:
 *   ts-node tests/manual/vertex-ai-smoke-test.ts gemini-2.5-flash
 *   ts-node tests/manual/vertex-ai-smoke-test.ts gemini-3-flash-preview
 *
 * Required environment variables:
 *   - GOOGLE_CLOUD_PROJECT: Your Google Cloud Project ID
 *   - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON
 *   - VERTEX_AI_REGION: (optional) Default: europe-west3
 *
 * Setup:
 *   1. Create a service account in Google Cloud Console
 *   2. Grant "Vertex AI User" role to the service account
 *   3. Download the JSON key file
 *   4. Set GOOGLE_APPLICATION_CREDENTIALS to the path of the JSON file
 *   5. Ensure the JSON file is in .gitignore (NEVER commit credentials!)
 */

import * as dotenv from 'dotenv';
import { LLMService } from '../../src/middleware/services/llm/llm.service';
import { LLMProvider, ReasoningEffort } from '../../src/middleware/services/llm/types';

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const ARG_MODEL = args[0];

// Configuration
const MODEL = ARG_MODEL || process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const REGION = process.env.VERTEX_AI_REGION || 'europe-west3';

// Test prompt - complex enough to see reasoning differences
// Note: Simple prompts won't show scaling because thinkingBudget is a LIMIT, not a target.
// The model only thinks as much as needed. Complex prompts force more reasoning.
const TEST_PROMPT = `Analyze this multi-step problem from three different perspectives and verify your solution:

A company has 3 factories (A, B, C) producing widgets. Factory A produces 40% of total output with a 2% defect rate. Factory B produces 35% with a 3% defect rate. Factory C produces 25% with a 5% defect rate.

1. Calculate the overall defect rate for the company
2. If a randomly selected widget is defective, what's the probability it came from Factory C? (Use Bayes' theorem)
3. The company wants to reduce the overall defect rate to 2%. If they can only improve ONE factory, which should they choose and by how much must that factory's defect rate decrease?
4. Verify your calculations by checking if all probabilities sum correctly and make logical sense.

Show all your reasoning steps and double-check your work.`;
const SYSTEM_MESSAGE = 'You are a mathematical analyst. Analyze problems from multiple perspectives, show detailed reasoning, verify your own calculations, and correct any errors you find in your thinking process.';

interface TestResult {
  reasoningEffort: ReasoningEffort;
  success: boolean;
  responsePreview: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  processingTime: number;
  error?: string;
}

async function runReasoningTest(
  llmService: LLMService,
  reasoningEffort: ReasoningEffort
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await llmService.callWithSystemMessage(
      TEST_PROMPT,
      SYSTEM_MESSAGE,
      {
        provider: LLMProvider.VERTEX_AI,
        model: MODEL,
        reasoningEffort: reasoningEffort,
        maxTokens: 16000,
        temperature: 0.7,
        debugContext: `vertex-ai-smoke-${reasoningEffort}`,
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
        processingTime: Date.now() - startTime,
        error: 'Response was null',
      };
    }

    return {
      reasoningEffort,
      success: true,
      responsePreview: response.message.content.substring(0, 150),
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
      reasoningTokens: response.usage?.reasoningTokens ?? 0,
      totalTokens: response.usage?.totalTokens ?? 0,
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
      processingTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runBasicTest(llmService: LLMService): Promise<boolean> {
  console.log('\n--- Basic Connectivity Test ---\n');

  try {
    const response = await llmService.callWithSystemMessage(
      'Say "Hello from Vertex AI!" and nothing else.',
      'You are a helpful assistant. Be concise.',
      {
        provider: LLMProvider.VERTEX_AI,
        model: MODEL,
        maxTokens: 100,
        temperature: 0,
        debugContext: 'vertex-ai-basic-test',
      }
    );

    if (response) {
      console.log('  Response:', response.message.content.trim());
      console.log('  Tokens:', response.usage?.totalTokens ?? 'N/A');
      console.log('  Processing Time:', response.metadata?.processingTime, 'ms');
      console.log('\n  Basic test: PASSED\n');
      return true;
    } else {
      console.log('  Basic test: FAILED (null response)\n');
      return false;
    }
  } catch (error) {
    console.log('  Basic test: FAILED');
    console.log('  Error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('VERTEX AI PROVIDER SMOKE TEST');
  console.log('='.repeat(70));
  console.log();

  // Validate environment
  if (!PROJECT_ID) {
    console.error('ERROR: GOOGLE_CLOUD_PROJECT is not set.');
    console.error('Please set it in your .env file.');
    process.exit(1);
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.VERTEX_AI_SERVICE_ACCOUNT_KEY) {
    console.error('ERROR: No service account credentials found.');
    console.error('Please set GOOGLE_APPLICATION_CREDENTIALS (path to JSON) or');
    console.error('VERTEX_AI_SERVICE_ACCOUNT_KEY (JSON string) in your .env file.');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  Project ID: ${PROJECT_ID}`);
  console.log(`  Region: ${REGION}`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Credentials: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'File' : 'Environment variable'}`);
  console.log();

  const llmService = new LLMService();

  // Run basic connectivity test first
  const basicTestPassed = await runBasicTest(llmService);
  if (!basicTestPassed) {
    console.error('Basic test failed. Please check your configuration and credentials.');
    process.exit(1);
  }

  // Run reasoning tests
  console.log('--- Reasoning Control Tests ---\n');
  console.log(`Testing with model: ${MODEL}`);

  // Detect model generation to show appropriate info
  const isGemini3 = MODEL.toLowerCase().includes('gemini-3');
  const isGemini25 = MODEL.toLowerCase().includes('gemini-2.5');

  if (isGemini3) {
    console.log('Model uses: thinkingLevel (MINIMAL/LOW/MEDIUM/HIGH)');
    console.log('Note: Gemini 3 does not support fully disabling thinking.');
  } else if (isGemini25) {
    console.log('Model uses: thinkingBudget (0 = disabled, up to 24576)');
  } else {
    console.log('Note: This model may not support reasoning control.');
  }
  console.log();

  const efforts: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];
  const results: TestResult[] = [];

  console.log('Running reasoning tests...');
  console.log('-'.repeat(70));

  for (const effort of efforts) {
    console.log(`\nTesting reasoningEffort: ${effort}`);
    const result = await runReasoningTest(llmService, effort);
    results.push(result);

    if (result.success) {
      console.log(`  Status: SUCCESS`);
      console.log(`  Response: "${result.responsePreview}..."`);
      console.log(`  Tokens: ${result.inputTokens} in / ${result.outputTokens} out / ${result.reasoningTokens} reasoning`);
      console.log(`  Total: ${result.totalTokens} tokens`);
      console.log(`  Time: ${result.processingTime}ms`);
    } else {
      console.log(`  Status: FAILED`);
      console.log(`  Error: ${result.error}`);
    }
  }

  // Summary
  console.log();
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();

  console.log('| Effort   | Status  | Out Tokens | Reasoning | Total     | Time (ms) |');
  console.log('|----------|---------|------------|-----------|-----------|-----------|');

  for (const result of results) {
    const status = result.success ? 'OK' : 'FAIL';
    console.log(
      `| ${result.reasoningEffort.padEnd(8)} | ${status.padEnd(7)} | ${result.outputTokens.toString().padStart(10)} | ${result.reasoningTokens.toString().padStart(9)} | ${result.totalTokens.toString().padStart(9)} | ${result.processingTime.toString().padStart(9)} |`
    );
  }

  console.log();

  // Comparison
  const noneResult = results.find(r => r.reasoningEffort === 'none');
  const highResult = results.find(r => r.reasoningEffort === 'high');

  if (noneResult?.success && highResult?.success) {
    const reasoningDiff = highResult.reasoningTokens - noneResult.reasoningTokens;

    console.log('Comparison (none vs high):');
    console.log(`  Reasoning token difference: ${reasoningDiff} tokens`);
    console.log(`  Time difference: ${highResult.processingTime - noneResult.processingTime}ms`);

    if (reasoningDiff > 0) {
      console.log('\n  Reasoning control is WORKING - higher effort = more reasoning tokens.');
    } else if (isGemini3 && noneResult.reasoningTokens > 0) {
      console.log('\n  Note: Gemini 3 always uses some reasoning (cannot be fully disabled).');
    }
  }

  console.log();

  // Final status
  const allPassed = results.every(r => r.success);
  if (allPassed) {
    console.log('ALL TESTS PASSED!');
    console.log();
    console.log(`Vertex AI provider is working correctly with ${MODEL} in ${REGION}.`);
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
