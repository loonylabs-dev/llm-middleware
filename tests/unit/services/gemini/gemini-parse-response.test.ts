/**
 * Unit Tests for Gemini parseResponse - Thinking Parts Filtering
 *
 * Tests the filtering of thinking parts from Gemini API responses.
 * When includeThoughts: true is set, Gemini returns:
 * - Parts with thought: true → thinking/reasoning content (should NOT be in content)
 * - Parts without thought → actual response content
 */

import { GeminiBaseProvider } from '../../../../src/middleware/services/llm/providers/gemini/gemini-base.provider';
import { GeminiAPIResponse } from '../../../../src/middleware/services/llm/types/gemini.types';
import { CommonLLMResponse, LLMProvider } from '../../../../src/middleware/services/llm/types';
import { AxiosRequestConfig } from 'axios';

/**
 * Testable implementation of GeminiBaseProvider that exposes protected methods.
 */
class TestableGeminiProvider extends GeminiBaseProvider {
  constructor() {
    super(LLMProvider.GOOGLE);
  }

  // Expose parseResponse for testing
  public testParseResponse(
    apiResponse: GeminiAPIResponse,
    sessionId: string,
    model: string,
    requestDuration: number
  ): CommonLLMResponse {
    return this.parseResponse(apiResponse, sessionId, model, requestDuration);
  }

  // Abstract method implementations (not used in tests)
  protected getBaseUrl(): string {
    return 'https://test.example.com';
  }

  protected async getAuthConfig(): Promise<AxiosRequestConfig> {
    return {};
  }

  protected getEndpointUrl(): string {
    return 'https://test.example.com/generateContent';
  }

  protected getDefaultModel(): string {
    return 'gemini-3-flash';
  }
}

describe('Gemini parseResponse - Thinking Parts Filtering', () => {
  let provider: TestableGeminiProvider;

  beforeEach(() => {
    provider = new TestableGeminiProvider();
  });

  describe('Response with thinking parts (thought: true)', () => {
    it('should filter thinking parts from content', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  text: '**Considering Chapter Structure**\n\nI\'m currently structuring the initial chapter...',
                  thought: true
                },
                {
                  text: '{\n  "content": "Der Flüsterwald machte seinem Namen alle Ehre..."\n}',
                  thoughtSignature: 'AYygR...'
                }
              ]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 3279,
          candidatesTokenCount: 918,
          totalTokenCount: 4197,
          thoughtsTokenCount: 122
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-3-flash', 1000);

      // Content should ONLY contain the JSON, NOT the thinking text
      expect(result.message.content).toBe('{\n  "content": "Der Flüsterwald machte seinem Namen alle Ehre..."\n}');
      expect(result.message.content).not.toContain('Considering Chapter Structure');
      expect(result.message.content).not.toContain('I\'m currently structuring');
    });

    it('should extract thinking text into separate field', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  text: '**Analyzing the problem**\n\nLet me break this down step by step...',
                  thought: true
                },
                {
                  text: 'The answer is 42.',
                  thoughtSignature: 'sig123'
                }
              ]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
          thoughtsTokenCount: 30
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-3-flash', 500);

      // Thinking should be in separate field
      expect(result.message.thinking).toBe('**Analyzing the problem**\n\nLet me break this down step by step...');
      // Content should only be the actual response
      expect(result.message.content).toBe('The answer is 42.');
    });

    it('should handle multiple thinking parts', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  text: 'First thought...',
                  thought: true
                },
                {
                  text: 'Second thought...',
                  thought: true
                },
                {
                  text: 'Actual response content.'
                }
              ]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-3-flash', 500);

      // Multiple thinking parts should be joined
      expect(result.message.thinking).toBe('First thought...\nSecond thought...');
      expect(result.message.content).toBe('Actual response content.');
    });
  });

  describe('Response without thinking parts', () => {
    it('should return content unchanged when no thinking parts', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { text: 'Hello, world!' },
                { text: 'How can I help you?' }
              ]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 50,
          candidatesTokenCount: 20,
          totalTokenCount: 70
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-3-flash', 300);

      // All parts should be in content
      expect(result.message.content).toBe('Hello, world!\nHow can I help you?');
      // No thinking field
      expect(result.message.thinking).toBeUndefined();
    });

    it('should not include thinking field when thought is explicitly false', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { text: 'Regular response', thought: false as any }
              ]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 50,
          candidatesTokenCount: 20,
          totalTokenCount: 70
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-3-flash', 300);

      expect(result.message.content).toBe('Regular response');
      expect(result.message.thinking).toBeUndefined();
    });
  });

  describe('Token usage preservation', () => {
    it('should correctly capture reasoningTokens from thoughtsTokenCount', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { text: 'Thinking...', thought: true },
                { text: 'Response' }
              ]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 200,
          thoughtsTokenCount: 50
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-3-flash', 500);

      expect(result.usage).toBeDefined();
      expect(result.usage?.inputTokens).toBe(100);
      expect(result.usage?.outputTokens).toBe(50);
      expect(result.usage?.totalTokens).toBe(200);
      expect(result.usage?.reasoningTokens).toBe(50);
    });

    it('should not include reasoningTokens when thoughtsTokenCount is not present', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Response' }]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-3-flash', 500);

      expect(result.usage).toBeDefined();
      expect(result.usage?.reasoningTokens).toBeUndefined();
    });
  });

  describe('Cache token tracking (implicit caching)', () => {
    it('should map cachedContentTokenCount to cacheMetadata.cacheReadTokens', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Cached response' }]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 2550,
          candidatesTokenCount: 42,
          totalTokenCount: 2592,
          cachedContentTokenCount: 2500
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-2.5-flash', 500);

      expect(result.usage).toBeDefined();
      expect(result.usage?.cacheMetadata).toBeDefined();
      expect(result.usage?.cacheMetadata?.cacheReadTokens).toBe(2500);
      expect(result.usage?.cacheMetadata?.cacheCreationTokens).toBeUndefined();
    });

    it('should not include cacheMetadata when cachedContentTokenCount is 0', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Non-cached response' }]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 500,
          candidatesTokenCount: 42,
          totalTokenCount: 542,
          cachedContentTokenCount: 0
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-2.5-flash', 500);

      expect(result.usage).toBeDefined();
      expect(result.usage?.cacheMetadata).toBeUndefined();
    });

    it('should not include cacheMetadata when cachedContentTokenCount is absent', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Response' }]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-2.5-flash', 500);

      expect(result.usage).toBeDefined();
      expect(result.usage?.cacheMetadata).toBeUndefined();
    });

    it('should include both reasoningTokens and cacheMetadata when both are present', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { text: 'Thinking...', thought: true },
                { text: 'Response' }
              ]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 3000,
          candidatesTokenCount: 50,
          totalTokenCount: 3200,
          thoughtsTokenCount: 150,
          cachedContentTokenCount: 2800
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-2.5-flash', 500);

      expect(result.usage).toBeDefined();
      expect(result.usage?.reasoningTokens).toBe(150);
      expect(result.usage?.cacheMetadata?.cacheReadTokens).toBe(2800);
    });
  });

  describe('Edge cases', () => {
    it('should throw error when no candidates returned', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: []
      };

      expect(() => {
        provider.testParseResponse(apiResponse, 'test-session', 'gemini-3-flash', 500);
      }).toThrow('No candidates returned from Gemini API');
    });

    it('should handle response with only thinking parts (edge case)', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { text: 'Only thinking here...', thought: true }
              ]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 0,
          totalTokenCount: 100,
          thoughtsTokenCount: 50
        }
      };

      const result = provider.testParseResponse(apiResponse, 'test-session', 'gemini-3-flash', 500);

      // Content should be empty string
      expect(result.message.content).toBe('');
      // Thinking should contain the thinking text
      expect(result.message.thinking).toBe('Only thinking here...');
    });

    it('should preserve metadata correctly', () => {
      const apiResponse: GeminiAPIResponse = {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text: 'Test response' }]
            },
            index: 0
          }
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150
        }
      };

      const result = provider.testParseResponse(apiResponse, 'my-session-id', 'gemini-3-pro', 1234);

      expect(result.sessionId).toBe('my-session-id');
      expect(result.metadata?.model).toBe('gemini-3-pro');
      expect(result.metadata?.processingTime).toBe(1234);
      expect(result.metadata?.provider).toBe('google');
    });
  });
});
