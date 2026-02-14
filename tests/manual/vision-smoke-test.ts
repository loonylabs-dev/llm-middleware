/**
 * Manual Smoke Test for Vision/Multimodal Input
 *
 * Tests that providers correctly handle image input alongside text.
 * Primary: Vertex AI + Gemini 3 Flash
 * Secondary: Google Direct API
 *
 * Usage:
 *   npm run test:vision:smoke
 *   # or with specific provider:
 *   npm run test:vision:smoke -- vertex_ai
 *   npm run test:vision:smoke -- google
 *   # with specific model:
 *   npm run test:vision:smoke -- vertex_ai gemini-3-flash-preview
 *
 * Required environment variables (Vertex AI):
 *   - GOOGLE_CLOUD_PROJECT: Your Google Cloud Project ID
 *   - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON
 *
 * Required environment variables (Google Direct):
 *   - GEMINI_API_KEY: Your Gemini API key
 *
 * @since 2.22.0
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { LLMService } from '../../src/middleware/services/llm/llm.service';
import { LLMProvider } from '../../src/middleware/services/llm/types';
import { ContentPart } from '../../src/middleware/services/llm/types/multimodal.types';

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const ARG_PROVIDER = args[0] as 'vertex_ai' | 'google' | undefined;
const ARG_MODEL = args[1];

// Configuration
const PROVIDER_KEY: LLMProvider = ARG_PROVIDER === 'google'
  ? LLMProvider.GOOGLE
  : LLMProvider.VERTEX_AI;
const MODEL = ARG_MODEL || process.env.VERTEX_AI_MODEL || 'gemini-3-flash-preview';
const REGION = process.env.VERTEX_AI_REGION || 'europe-west3';

// Load test image from fixtures directory
const TEST_IMAGE_PATH = path.resolve(__dirname, '../fixtures/images/unicorn-test-image.png');
let TEST_IMAGE_BASE64: string;

try {
  TEST_IMAGE_BASE64 = fs.readFileSync(TEST_IMAGE_PATH).toString('base64');
  const sizeKB = Math.round(fs.statSync(TEST_IMAGE_PATH).size / 1024);
  console.log(`Loaded test image: ${TEST_IMAGE_PATH} (${sizeKB} KB)`);
} catch (err) {
  console.error(`ERROR: Could not load test image at ${TEST_IMAGE_PATH}`);
  console.error('Please ensure tests/fixtures/images/unicorn-test-image.png exists.');
  process.exit(1);
}

const TEST_IMAGE_MIME = 'image/png' as const;
const SYSTEM_MESSAGE = 'You are a helpful image analyst. Describe images concisely and accurately.';

interface TestResult {
  testName: string;
  success: boolean;
  response?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  processingTime?: number;
  error?: string;
}

async function runVisionTest(
  llmService: LLMService,
  testName: string,
  content: ContentPart[],
  systemMessage: string
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await llmService.callWithSystemMessage(
      content,
      systemMessage,
      {
        provider: PROVIDER_KEY,
        model: MODEL,
        maxTokens: 256,
        temperature: 0.3,
        region: REGION,
        debugContext: `vision-smoke-${testName}`,
      }
    );

    if (!response) {
      return {
        testName,
        success: false,
        processingTime: Date.now() - startTime,
        error: 'Response was null',
      };
    }

    return {
      testName,
      success: true,
      response: response.message.content.trim(),
      inputTokens: response.usage?.inputTokens,
      outputTokens: response.usage?.outputTokens,
      totalTokens: response.usage?.totalTokens,
      processingTime: response.metadata?.processingTime ?? Date.now() - startTime,
    };
  } catch (error) {
    return {
      testName,
      success: false,
      processingTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('VISION / MULTIMODAL INPUT SMOKE TEST');
  console.log('='.repeat(70));
  console.log();

  // Validate environment
  if (PROVIDER_KEY === LLMProvider.VERTEX_AI) {
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      console.error('ERROR: GOOGLE_CLOUD_PROJECT is not set.');
      process.exit(1);
    }
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.VERTEX_AI_SERVICE_ACCOUNT_KEY) {
      console.error('ERROR: No service account credentials found.');
      process.exit(1);
    }
  } else {
    if (!process.env.GEMINI_API_KEY) {
      console.error('ERROR: GEMINI_API_KEY is not set.');
      process.exit(1);
    }
  }

  console.log('Configuration:');
  console.log(`  Provider: ${PROVIDER_KEY}`);
  console.log(`  Model: ${MODEL}`);
  if (PROVIDER_KEY === LLMProvider.VERTEX_AI) {
    console.log(`  Region: ${REGION}`);
    console.log(`  Project: ${process.env.GOOGLE_CLOUD_PROJECT}`);
  }
  console.log();

  const llmService = new LLMService();
  const results: TestResult[] = [];

  // ---------------------------------------------------------------
  // Test 1: String input (backward-compatibility)
  // ---------------------------------------------------------------
  console.log('Test 1: String input (backward-compatible)');
  const stringResult = await runVisionTest(
    llmService,
    'string-input',
    [{ type: 'text', text: 'Say "Vision test OK" and nothing else.' }],
    'You are a helpful assistant. Be concise.'
  );
  results.push(stringResult);
  console.log(`  ${stringResult.success ? 'PASSED' : 'FAILED'}: ${stringResult.response || stringResult.error}`);

  // ---------------------------------------------------------------
  // Test 2: Image + text (basic vision)
  // ---------------------------------------------------------------
  console.log('\nTest 2: Image + text (basic vision)');
  const visionResult = await runVisionTest(
    llmService,
    'image-text',
    [
      { type: 'image', data: TEST_IMAGE_BASE64, mimeType: TEST_IMAGE_MIME },
      { type: 'text', text: 'Describe this image in one sentence. What characters and colors do you see?' }
    ],
    SYSTEM_MESSAGE
  );
  results.push(visionResult);
  console.log(`  ${visionResult.success ? 'PASSED' : 'FAILED'}: ${visionResult.response?.substring(0, 150) || visionResult.error}`);

  // ---------------------------------------------------------------
  // Test 3: Text before image
  // ---------------------------------------------------------------
  console.log('\nTest 3: Text before image (reversed order)');
  const reversedResult = await runVisionTest(
    llmService,
    'text-before-image',
    [
      { type: 'text', text: 'I will show you an illustration. Describe what you see in one sentence.' },
      { type: 'image', data: TEST_IMAGE_BASE64, mimeType: TEST_IMAGE_MIME }
    ],
    SYSTEM_MESSAGE
  );
  results.push(reversedResult);
  console.log(`  ${reversedResult.success ? 'PASSED' : 'FAILED'}: ${reversedResult.response?.substring(0, 150) || reversedResult.error}`);

  // ---------------------------------------------------------------
  // Test 4: Image-only (no text besides system message)
  // ---------------------------------------------------------------
  console.log('\nTest 4: Image-only (no text in user message)');
  const imageOnlyResult = await runVisionTest(
    llmService,
    'image-only',
    [
      { type: 'image', data: TEST_IMAGE_BASE64, mimeType: TEST_IMAGE_MIME }
    ],
    'Describe the image in one sentence.'
  );
  results.push(imageOnlyResult);
  console.log(`  ${imageOnlyResult.success ? 'PASSED' : 'FAILED'}: ${imageOnlyResult.response?.substring(0, 150) || imageOnlyResult.error}`);

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  console.log();
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log();

  console.log('| Test                    | Status | Tokens  | Time (ms) |');
  console.log('|-------------------------|--------|---------|-----------|');
  for (const result of results) {
    const status = result.success ? 'OK' : 'FAIL';
    const tokens = result.totalTokens?.toString() || 'N/A';
    const time = result.processingTime?.toString() || 'N/A';
    console.log(`| ${result.testName.padEnd(23)} | ${status.padEnd(6)} | ${tokens.padStart(7)} | ${time.padStart(9)} |`);
  }

  console.log();
  const allPassed = results.every(r => r.success);
  if (allPassed) {
    console.log('ALL VISION TESTS PASSED!');
    console.log(`Vision/multimodal input is working with ${MODEL} via ${PROVIDER_KEY}.`);
  } else {
    console.log('SOME TESTS FAILED!');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
