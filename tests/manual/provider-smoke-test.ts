/**
 * Parametrized smoke test for LLM providers
 * Tests any provider by specifying TEST_PROVIDER environment variable
 *
 * Usage:
 *   npm run test:provider:ollama    - Test Ollama provider
 *   npm run test:provider:anthropic - Test Anthropic provider
 *   TEST_PROVIDER=anthropic ts-node tests/manual/provider-smoke-test.ts
 */

import * as dotenv from 'dotenv';
import { LLMService } from '../../src/middleware/services/llm/llm.service';
import { LLMProvider } from '../../src/middleware/services/llm/types';
import { DataFlowLoggerService } from '../../src/middleware/services/data-flow-logger/data-flow-logger.service';
import { getMemoryUsage } from '../../src/middleware/shared/utils/memory-management.utils';

// Load environment variables
dotenv.config();

// Determine which provider to test
const providerName = (process.env.TEST_PROVIDER || 'ollama').toLowerCase();
let provider: LLMProvider;
let modelName: string | undefined;
let apiKey: string | undefined;
let baseUrl: string | undefined;

switch (providerName) {
  case 'ollama':
    provider = LLMProvider.OLLAMA;
    modelName = process.env.MODEL1_NAME;
    baseUrl = process.env.MODEL1_URL || 'http://localhost:11434';
    apiKey = process.env.MODEL1_TOKEN;
    break;

  case 'anthropic':
    provider = LLMProvider.ANTHROPIC;
    modelName = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    apiKey = process.env.ANTHROPIC_API_KEY;
    break;

  case 'requesty':
    provider = LLMProvider.REQUESTY;
    modelName = process.env.REQUESTY_MODEL || 'openai/gpt-4o';
    apiKey = process.env.REQUESTY_API_KEY;
    break;

  default:
    console.error(`❌ Unknown provider: ${providerName}`);
    console.log('Available providers: ollama, anthropic, requesty');
    process.exit(1);
}

async function runProviderSmokeTest() {
  console.log('🚀 Starting Provider Smoke Test');
  console.log('==========================================');
  console.log(`Provider: ${provider}`);
  console.log(`Model: ${modelName || 'not configured'}`);
  if (baseUrl) {
    console.log(`Base URL: ${baseUrl}`);
  }
  console.log(`API Key configured: ${!!apiKey}`);
  console.log('==========================================\n');

  // Test 1: Memory Utils
  console.log('📊 Test 1: Memory Management Utils');
  const memoryBefore = getMemoryUsage();
  console.log('Memory usage:', memoryBefore);
  console.log('✅ Memory utils working\n');

  // Test 2: DataFlowLogger
  console.log('📝 Test 2: DataFlowLogger');
  const dataFlowLogger = DataFlowLoggerService.getInstance();
  const requestId = dataFlowLogger.startRequest('smoke-test', {});
  console.log('Request ID:', requestId);
  console.log('✅ DataFlowLogger working\n');

  // Test 3: LLM Service with specified provider
  console.log(`🤖 Test 3: ${provider} Provider via LLM Service`);

  // Validate configuration
  if (!modelName) {
    console.error(`❌ Model name not configured for ${provider}`);
    if (provider === LLMProvider.OLLAMA) {
      console.log('Please set MODEL1_NAME in your .env file');
    } else if (provider === LLMProvider.ANTHROPIC) {
      console.log('Please set ANTHROPIC_MODEL in your .env file');
    } else if (provider === LLMProvider.REQUESTY) {
      console.log('Please set REQUESTY_MODEL in your .env file');
    }
    process.exit(1);
  }

  if (!apiKey && provider !== LLMProvider.OLLAMA) {
    console.error(`❌ API key not configured for ${provider}`);
    if (provider === LLMProvider.ANTHROPIC) {
      console.log('Please set ANTHROPIC_API_KEY in your .env file');
    } else if (provider === LLMProvider.REQUESTY) {
      console.log('Please set REQUESTY_API_KEY in your .env file');
    }
    process.exit(1);
  }

  const llmService = new LLMService();

  console.log('Attempting to call API...');

  try {
    const requestStartTime = Date.now();

    const response = await llmService.callWithSystemMessage(
      'Say "Hello from llm-middleware test!" in exactly 5 words.',
      'You are a helpful assistant.',
      {
        provider: provider,
        model: modelName,
        temperature: 0.7,
        ...(baseUrl && { baseUrl }),
        ...(apiKey && { authToken: apiKey }),
        ...(provider === LLMProvider.ANTHROPIC && { maxTokens: 1024 }),
        debugContext: 'provider-smoke-test',
        sessionId: `smoke-${provider}-${Date.now()}`
      }
    );

    const requestDuration = Date.now() - requestStartTime;

    if (response) {
      console.log('✅ API call successful!');
      console.log('Response preview:', response.message.content.substring(0, 200));
      console.log('Response length:', response.message.content.length);
      console.log('Session ID:', response.sessionId);
      console.log('Request duration:', `${requestDuration}ms`);

      if (response.metadata) {
        console.log('\n📊 Metadata:');
        console.log('  Provider:', response.metadata.provider);
        console.log('  Model:', response.metadata.model);
        console.log('  Tokens used:', response.metadata.tokensUsed);
        console.log('  Processing time:', `${response.metadata.processingTime}ms`);
      }

      // Check if logs were created
      console.log('\n📁 Checking log files...');
      const fs = require('fs');
      const path = require('path');
      const logsDir = path.join(process.cwd(), 'logs', 'llm', provider, 'requests');

      if (fs.existsSync(logsDir)) {
        const files = fs.readdirSync(logsDir);
        console.log(`Found ${files.length} log files in ${logsDir}`);

        if (files.length > 0) {
          const latestLog = files.sort().reverse()[0];
          console.log('Latest log:', latestLog);

          const logPath = path.join(logsDir, latestLog);
          const logContent = fs.readFileSync(logPath, 'utf-8');
          const hasCompleteResponseData = logContent.includes('## Complete Response Data') ||
                                          logContent.includes('## Response');

          console.log('Contains response data:', hasCompleteResponseData);

          if (hasCompleteResponseData) {
            console.log('✅ Enhanced logging features verified!');
          } else {
            console.log('⚠️  Some logging features may be missing');
          }
        }
      } else {
        console.log(`⚠️  Log directory not found: ${logsDir}`);
      }

      console.log('\n✨ ALL TESTS PASSED! ✨');
    } else {
      console.log('❌ API call returned null');

      if (provider === LLMProvider.OLLAMA) {
        console.log(`⚠️  Check if Ollama is running at ${baseUrl}`);
        console.log(`⚠️  Check if model is available: \`ollama pull ${modelName}\``);
      } else if (provider === LLMProvider.ANTHROPIC) {
        console.log('⚠️  Check if your ANTHROPIC_API_KEY is valid');
        console.log('⚠️  Check if you have sufficient credits');
      } else if (provider === LLMProvider.REQUESTY) {
        console.log('⚠️  Check if your REQUESTY_API_KEY is valid');
        console.log('⚠️  Check if you have sufficient credits');
        console.log('⚠️  Check if the model is available on Requesty.ai');
      }
    }
  } catch (error) {
    console.log('❌ API call failed');
    console.error('Error:', error instanceof Error ? error.message : error);

    if (provider === LLMProvider.OLLAMA) {
      console.log('\n⚠️  Troubleshooting for Ollama:');
      console.log(`   - Make sure Ollama is running: \`ollama serve\``);
      console.log(`   - Make sure model is available: \`ollama pull ${modelName}\``);
      console.log(`   - Check base URL: ${baseUrl}`);
    } else if (provider === LLMProvider.ANTHROPIC) {
      console.log('\n⚠️  Troubleshooting for Anthropic:');
      console.log('   - Verify your API key is correct');
      console.log('   - Check your account has sufficient credits');
      console.log('   - Ensure the model name is valid');
    } else if (provider === LLMProvider.REQUESTY) {
      console.log('\n⚠️  Troubleshooting for Requesty:');
      console.log('   - Verify your API key is correct');
      console.log('   - Check your account has sufficient credits');
      console.log('   - Ensure the model name is valid (format: provider/model-name)');
      console.log('   - Example models: openai/gpt-4o, anthropic/claude-3-5-sonnet');
    }

    process.exit(1);
  }

  // Final memory check
  console.log('\n📊 Final memory usage:');
  const memoryAfter = getMemoryUsage();
  console.log(memoryAfter);

  console.log('\n==========================================');
  console.log(`🏁 ${provider} Provider Smoke Test Complete`);
}

// Run the test
runProviderSmokeTest().catch(console.error);
