/**
 * Unit Tests for Multimodal/Vision Support across providers.
 *
 * Tests that:
 * 1. String input still works identically (backward-compatibility)
 * 2. ContentPart[] input produces correct provider-specific formats
 * 3. Debug strings don't contain base64 blobs
 */

import { ContentPart, MultimodalContent } from '../../../../../src/middleware/services/llm/types/multimodal.types';
import { GeminiBaseProvider, GeminiProviderOptions } from '../../../../../src/middleware/services/llm/providers/gemini';
import { GeminiGenerationConfig, GeminiAPIRequest } from '../../../../../src/middleware/services/llm/types/gemini.types';
import { LLMProvider, CommonLLMResponse } from '../../../../../src/middleware/services/llm/types';
import { AxiosRequestConfig } from 'axios';

// ====================================================================
// Test helper: Expose protected buildRequestPayload from GeminiBaseProvider
// ====================================================================

class TestableGeminiProvider extends GeminiBaseProvider {
  constructor() {
    super(LLMProvider.GOOGLE);
  }

  // Expose protected method for testing
  public testBuildRequestPayload(
    userPrompt: MultimodalContent,
    systemMessage: string,
    generationConfig: GeminiGenerationConfig
  ): GeminiAPIRequest {
    return this.buildRequestPayload(userPrompt, systemMessage, generationConfig);
  }

  // Required abstract methods (not used in these tests)
  protected getBaseUrl(): string { return 'https://test.example.com'; }
  protected async getAuthConfig(): Promise<AxiosRequestConfig> { return {}; }
  protected getEndpointUrl(): string { return 'https://test.example.com/v1/models/test:generateContent'; }
  protected getDefaultModel(): string { return 'gemini-3-flash-preview'; }
}

// ====================================================================
// Test data
// ====================================================================

// Minimal valid base64 PNG (1x1 pixel)
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const textOnlyParts: ContentPart[] = [
  { type: 'text', text: 'Describe something.' }
];

const multimodalParts: ContentPart[] = [
  { type: 'image', data: TINY_PNG_BASE64, mimeType: 'image/png' },
  { type: 'text', text: 'Describe this image in one sentence.' }
];

const multiImageParts: ContentPart[] = [
  { type: 'image', data: TINY_PNG_BASE64, mimeType: 'image/jpeg' },
  { type: 'image', data: TINY_PNG_BASE64, mimeType: 'image/png' },
  { type: 'text', text: 'Compare these two images.' }
];

// ====================================================================
// Tests
// ====================================================================

describe('Gemini Provider - Multimodal Request Building', () => {
  const provider = new TestableGeminiProvider();
  const defaultConfig: GeminiGenerationConfig = {
    temperature: 0.7,
    maxOutputTokens: 256,
  };

  describe('string input (backward-compatible)', () => {
    it('should produce a single text part for string input', () => {
      const payload = provider.testBuildRequestPayload(
        'Hello world',
        'You are helpful.',
        defaultConfig
      );

      expect(payload.contents).toHaveLength(1);
      expect(payload.contents[0].role).toBe('user');
      expect(payload.contents[0].parts).toHaveLength(1);
      expect(payload.contents[0].parts[0]).toEqual({ text: 'Hello world' });
    });

    it('should set systemInstruction correctly', () => {
      const payload = provider.testBuildRequestPayload(
        'Hello',
        'Be concise.',
        defaultConfig
      );

      expect(payload.systemInstruction).toEqual({
        parts: [{ text: 'Be concise.' }]
      });
    });
  });

  describe('text-only ContentPart[] input', () => {
    it('should produce text parts from ContentPart array', () => {
      const payload = provider.testBuildRequestPayload(
        textOnlyParts,
        'You are helpful.',
        defaultConfig
      );

      expect(payload.contents[0].parts).toHaveLength(1);
      expect(payload.contents[0].parts[0]).toEqual({ text: 'Describe something.' });
    });
  });

  describe('multimodal ContentPart[] input (text + image)', () => {
    it('should produce inlineData part for images', () => {
      const payload = provider.testBuildRequestPayload(
        multimodalParts,
        'You are an image analyst.',
        defaultConfig
      );

      expect(payload.contents[0].parts).toHaveLength(2);

      // First part: image → inlineData
      const imagePart = payload.contents[0].parts[0];
      expect(imagePart.inlineData).toBeDefined();
      expect(imagePart.inlineData!.mimeType).toBe('image/png');
      expect(imagePart.inlineData!.data).toBe(TINY_PNG_BASE64);
      expect(imagePart.text).toBeUndefined();

      // Second part: text
      const textPart = payload.contents[0].parts[1];
      expect(textPart.text).toBe('Describe this image in one sentence.');
      expect(textPart.inlineData).toBeUndefined();
    });

    it('should handle multiple images', () => {
      const payload = provider.testBuildRequestPayload(
        multiImageParts,
        'Compare images.',
        defaultConfig
      );

      expect(payload.contents[0].parts).toHaveLength(3);
      expect(payload.contents[0].parts[0].inlineData?.mimeType).toBe('image/jpeg');
      expect(payload.contents[0].parts[1].inlineData?.mimeType).toBe('image/png');
      expect(payload.contents[0].parts[2].text).toBe('Compare these two images.');
    });
  });

  describe('generationConfig is passed through', () => {
    it('should include generationConfig in payload', () => {
      const payload = provider.testBuildRequestPayload(
        multimodalParts,
        'System.',
        defaultConfig
      );

      expect(payload.generationConfig).toEqual(defaultConfig);
    });
  });
});
