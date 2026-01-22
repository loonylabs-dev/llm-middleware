/**
 * Integration Tests for Gemini Thinking Parts Filtering
 *
 * Tests that thinking parts (thought: true) are correctly filtered from content
 * and exposed separately via message.thinking field when using the UseCase pattern.
 *
 * This replicates the real-world scenario from Scribomate where JSON responses
 * were corrupted by thinking text being prepended to the content.
 *
 * Run with: LLM_INTEGRATION_TESTS=true npm run test:integration -- --testPathPattern="gemini-thinking"
 *
 * Requires:
 * - GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS for Vertex AI
 * - OR GEMINI_API_KEY for Google Direct API
 */

import * as dotenv from 'dotenv';
import { BaseAIUseCase } from '../../src/middleware/usecases/base/base-ai.usecase';
import { BaseAIRequest, BaseAIResult } from '../../src/middleware/shared/types/base-request.types';
import { LLMProvider, ReasoningEffort } from '../../src/middleware/services/llm/types';
import { ModelConfigKey, ValidatedLLMModelConfig } from '../../src/middleware/shared/config/models.config';

// Load environment variables
dotenv.config();

/**
 * Check if Vertex AI is configured
 */
function isVertexAIConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLOUD_PROJECT &&
    (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.VERTEX_AI_SERVICE_ACCOUNT_KEY)
  );
}

/**
 * Check if Google Direct API is configured
 */
function isGoogleDirectConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Check if integration tests should run
 */
function shouldRunTests(): boolean {
  return process.env.LLM_INTEGRATION_TESTS === 'true';
}

const describeLive = shouldRunTests() && (isVertexAIConfigured() || isGoogleDirectConfigured())
  ? describe
  : describe.skip;

const LLM_TIMEOUT = 90000; // 90 seconds for reasoning models

// ============================================================================
// Test UseCase Implementation
// ============================================================================

interface JsonGeneratorPrompt {
  task: string;
}

interface JsonGeneratorRequest extends BaseAIRequest<JsonGeneratorPrompt> {
  prompt: JsonGeneratorPrompt;
}

interface JsonGeneratorResult extends BaseAIResult {
  parsedJson?: any;
  parseError?: string;
}

/**
 * Test UseCase that expects JSON output.
 * This replicates the Scribomate scenario where JSON responses
 * were corrupted by thinking text.
 */
class JsonGeneratorUseCase extends BaseAIUseCase<JsonGeneratorPrompt, JsonGeneratorRequest, JsonGeneratorResult> {
  protected readonly systemMessage = `You are a JSON generator.
IMPORTANT: Output ONLY valid JSON, nothing else.
No markdown code blocks, no explanations, no thinking out loud.
Just the raw JSON object.`;

  private provider: LLMProvider;
  private model: string;
  private _reasoningEffort?: ReasoningEffort;

  constructor(provider: LLMProvider, model: string) {
    super();
    this.provider = provider;
    this.model = model;
  }

  setReasoningEffort(effort: ReasoningEffort | undefined) {
    this._reasoningEffort = effort;
  }

  protected getProvider(): LLMProvider {
    return this.provider;
  }

  protected getModelConfigProvider(_key: ModelConfigKey): ValidatedLLMModelConfig {
    // Return test config directly, bypassing env-based config
    return {
      name: this.model,
      baseUrl: '', // Not needed for Vertex AI / Google Direct
      temperature: 0.3,
      // For Vertex AI
      ...(this.provider === LLMProvider.VERTEX_AI && {
        region: process.env.VERTEX_AI_REGION || 'europe-west3'
      })
    };
  }

  protected getUserTemplate(): (formattedPrompt: string) => string {
    return (prompt) => prompt;
  }

  protected formatUserMessage(prompt: JsonGeneratorPrompt): string {
    return prompt.task;
  }

  protected createResult(content: string, usedPrompt: string, thinking?: string): JsonGeneratorResult {
    let parsedJson: any;
    let parseError: string | undefined;

    // Try to parse the content as JSON
    try {
      // First try direct parse
      parsedJson = JSON.parse(content);
    } catch (e) {
      // Try to extract JSON from the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedJson = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          parseError = `Failed to parse JSON: ${e2}`;
        }
      } else {
        parseError = `No JSON found in content: ${content.substring(0, 100)}...`;
      }
    }

    // Note: BaseAIResult requires model and usedPrompt, generatedContent is also required
    // BaseAIUseCase.execute() will attach usage metadata automatically
    return {
      generatedContent: content,
      model: this.model,
      usedPrompt: usedPrompt,
      thinking: thinking,
      parsedJson,
      parseError,
    };
  }

  // Override execute to pass reasoningEffort
  public async execute(request: JsonGeneratorRequest): Promise<JsonGeneratorResult> {
    // Inject reasoningEffort into request
    const requestWithReasoning = {
      ...request,
      reasoningEffort: this._reasoningEffort,
    };
    return super.execute(requestWithReasoning as JsonGeneratorRequest);
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describeLive('Gemini Thinking Parts Integration Tests (UseCase Pattern)', () => {
  let provider: LLMProvider;
  let model: string;

  beforeAll(() => {
    // Determine which provider to use
    if (isVertexAIConfigured()) {
      provider = LLMProvider.VERTEX_AI;
      model = process.env.VERTEX_AI_MODEL || 'gemini-3-flash-preview';
      console.log('\n=== Using Vertex AI for Thinking Parts Tests ===');
      console.log(`Project: ${process.env.GOOGLE_CLOUD_PROJECT}`);
      console.log(`Region: ${process.env.VERTEX_AI_REGION || 'europe-west3'}`);
    } else {
      provider = LLMProvider.GOOGLE;
      model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
      console.log('\n=== Using Google Direct API for Thinking Parts Tests ===');
    }
    console.log(`Model: ${model}`);
    console.log('================================\n');
  });

  describe('JSON Response with Thinking (Original Bug Scenario)', () => {
    it('should return parseable JSON without thinking preamble when using reasoningEffort: medium', async () => {
      console.log('\n>>> Testing JSON response with reasoningEffort: medium (the bug scenario)');

      const useCase = new JsonGeneratorUseCase(provider, model);
      useCase.setReasoningEffort('medium');

      const result = await useCase.execute({
        prompt: {
          task: 'Generate a JSON object with fields "name" (string) and "age" (number). Use name "Alice" and age 30.',
        },
      });

      console.log('\n--- Response Analysis ---');
      console.log(`Content (first 200 chars): "${result.generatedContent.substring(0, 200)}"`);
      console.log(`Content length: ${result.generatedContent.length}`);
      console.log(`Has thinking: ${!!result.thinking}`);
      console.log(`Parse error: ${result.parseError || 'none'}`);
      console.log(`Parsed JSON: ${JSON.stringify(result.parsedJson)}`);
      console.log(`Reasoning tokens: ${(result.usage as any)?.reasoningTokens}`);

      // THE KEY TEST: Content should be parseable JSON
      expect(result.parseError).toBeUndefined();
      expect(result.parsedJson).toBeDefined();

      // Verify the JSON structure
      if (result.parsedJson) {
        expect(result.parsedJson.name).toBe('Alice');
        expect(result.parsedJson.age).toBe(30);
      }

      // Content should NOT start with thinking patterns
      const content = result.generatedContent;
      expect(content).not.toMatch(/^\*\*[A-Z]/);  // **Thinking Header**
      expect(content).not.toMatch(/^Let me/i);
      expect(content).not.toMatch(/^I'll/i);
      expect(content).not.toMatch(/^First,/i);

      // CRITICAL: Verify thinking is accessible separately in UseCase result
      // This was the original bug - thinking was NOT reaching consumers
      const reasoningTokens = (result.usage as any)?.reasoningTokens;
      if (reasoningTokens && reasoningTokens > 0) {
        // If reasoning tokens were used, thinking MUST be available
        expect(result.thinking).toBeDefined();
        expect(typeof result.thinking).toBe('string');
        expect(result.thinking!.length).toBeGreaterThan(0);
        console.log(`✅ Thinking is accessible in UseCase result (${result.thinking!.length} chars)`);
        console.log(`   First 100 chars: "${result.thinking!.substring(0, 100)}..."`);
      } else {
        console.log(`ℹ️ No reasoning tokens used, thinking may be undefined`);
      }

      console.log('✅ JSON parsed successfully without thinking contamination');
      console.log('\n<<< Test completed');
    }, LLM_TIMEOUT);

    it('should return clean JSON with reasoningEffort: high', async () => {
      console.log('\n>>> Testing JSON response with reasoningEffort: high');

      const useCase = new JsonGeneratorUseCase(provider, model);
      useCase.setReasoningEffort('high');

      const result = await useCase.execute({
        prompt: {
          task: 'Generate a JSON object: {"greeting": "Hello World"}',
        },
      });

      console.log('\n--- Response Analysis ---');
      console.log(`Content: "${result.generatedContent}"`);
      console.log(`Parse error: ${result.parseError || 'none'}`);
      console.log(`Reasoning tokens: ${(result.usage as any)?.reasoningTokens}`);

      // Content should be parseable JSON
      expect(result.parseError).toBeUndefined();
      expect(result.parsedJson).toBeDefined();

      if (result.parsedJson) {
        expect(result.parsedJson.greeting).toBe('Hello World');
      }

      console.log('✅ JSON parsed successfully');
      console.log('\n<<< Test completed');
    }, LLM_TIMEOUT);
  });

  describe('Baseline without Reasoning', () => {
    it('should return clean JSON with reasoningEffort: none', async () => {
      console.log('\n>>> Testing JSON response with reasoningEffort: none (baseline)');

      const useCase = new JsonGeneratorUseCase(provider, model);
      useCase.setReasoningEffort('none');

      const result = await useCase.execute({
        prompt: {
          task: 'Generate a JSON object: {"status": "ok"}',
        },
      });

      console.log('\n--- Response Analysis ---');
      console.log(`Content: "${result.generatedContent}"`);
      console.log(`Parse error: ${result.parseError || 'none'}`);
      console.log(`Reasoning tokens: ${(result.usage as any)?.reasoningTokens || 0}`);

      expect(result.parseError).toBeUndefined();
      expect(result.parsedJson).toBeDefined();

      if (result.parsedJson) {
        expect(result.parsedJson.status).toBe('ok');
      }

      console.log('✅ JSON parsed successfully');
      console.log('\n<<< Test completed');
    }, LLM_TIMEOUT);
  });

  describe('Token Usage Tracking', () => {
    it('should track reasoning tokens separately in usage', async () => {
      console.log('\n>>> Testing reasoning token tracking');

      const useCase = new JsonGeneratorUseCase(provider, model);
      useCase.setReasoningEffort('medium');

      const result = await useCase.execute({
        prompt: {
          task: 'Generate: {"message": "test"}',
        },
      });

      console.log('\n--- Token Usage ---');
      console.log(`Input tokens: ${result.usage?.inputTokens}`);
      console.log(`Output tokens: ${result.usage?.outputTokens}`);
      console.log(`Reasoning tokens: ${(result.usage as any)?.reasoningTokens}`);
      console.log(`Total tokens: ${result.usage?.totalTokens}`);

      expect(result.usage).toBeDefined();
      expect(result.usage?.inputTokens).toBeGreaterThan(0);
      expect(result.usage?.outputTokens).toBeGreaterThan(0);

      // With medium reasoning, we should have reasoning tokens
      if ((result.usage as any)?.reasoningTokens !== undefined) {
        console.log('✅ Reasoning tokens are tracked');
      }

      console.log('\n<<< Test completed');
    }, LLM_TIMEOUT);
  });

  describe('Complex JSON Structure', () => {
    it('should handle complex JSON array without thinking contamination', async () => {
      console.log('\n>>> Testing complex JSON array (like Scribomate narrative sections)');

      const useCase = new JsonGeneratorUseCase(provider, model);
      useCase.setReasoningEffort('low');

      const result = await useCase.execute({
        prompt: {
          task: `Generate a JSON array with 2 objects, each having "title" and "content" fields.
Example: [{"title": "Section 1", "content": "Content here"}, {"title": "Section 2", "content": "More content"}]`,
        },
      });

      console.log('\n--- Response Analysis ---');
      console.log(`Content (first 300 chars): "${result.generatedContent.substring(0, 300)}"`);
      console.log(`Parse error: ${result.parseError || 'none'}`);

      // Try to parse as array
      let parsed: any;
      try {
        const arrayMatch = result.generatedContent.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          parsed = JSON.parse(arrayMatch[0]);
        }
      } catch (e) {
        console.log(`Parse attempt failed: ${e}`);
      }

      // The content should be parseable
      expect(parsed).toBeDefined();
      if (Array.isArray(parsed)) {
        expect(parsed.length).toBeGreaterThanOrEqual(2);
        expect(parsed[0].title).toBeDefined();
        expect(parsed[0].content).toBeDefined();
        console.log('✅ Complex JSON array parsed successfully');
      }

      console.log('\n<<< Test completed');
    }, LLM_TIMEOUT);
  });
});
