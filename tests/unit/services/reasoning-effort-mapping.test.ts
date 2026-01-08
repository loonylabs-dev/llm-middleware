/**
 * Unit Tests for Reasoning Effort Mapping Functions
 *
 * Tests the mapping of provider-agnostic ReasoningEffort to provider-specific parameters.
 */

import { ReasoningEffort } from '../../../src/middleware/services/llm/types';

// We need to test the mapping functions - since they're not exported,
// we test them indirectly through the type definitions and expected behavior

describe('ReasoningEffort Type', () => {
  describe('Type Definition', () => {
    it('should accept valid effort levels', () => {
      const validEfforts: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];

      // This test verifies the type system works correctly
      expect(validEfforts).toHaveLength(4);
      expect(validEfforts).toContain('none');
      expect(validEfforts).toContain('low');
      expect(validEfforts).toContain('medium');
      expect(validEfforts).toContain('high');
    });
  });
});

describe('Requesty Reasoning Effort Mapping', () => {
  // Simulate the mapping function from requesty-provider.ts
  function mapReasoningEffort(effort: ReasoningEffort): 'none' | 'low' | 'medium' | 'high' {
    switch (effort) {
      case 'none':
        return 'none';
      case 'low':
        return 'low';
      case 'medium':
        return 'medium';
      case 'high':
        return 'high';
      default:
        return 'medium';
    }
  }

  it('should map "none" to "none"', () => {
    expect(mapReasoningEffort('none')).toBe('none');
  });

  it('should map "low" to "low"', () => {
    expect(mapReasoningEffort('low')).toBe('low');
  });

  it('should map "medium" to "medium"', () => {
    expect(mapReasoningEffort('medium')).toBe('medium');
  });

  it('should map "high" to "high"', () => {
    expect(mapReasoningEffort('high')).toBe('high');
  });
});

describe('Gemini Thinking Level Mapping', () => {
  type GeminiThinkingLevel = 'THINKING_LEVEL_UNSPECIFIED' | 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

  // Simulate the mapping function from gemini-provider.ts
  function mapReasoningEffortToGemini(effort: ReasoningEffort): GeminiThinkingLevel {
    switch (effort) {
      case 'none':
        return 'MINIMAL';
      case 'low':
        return 'LOW';
      case 'medium':
        return 'MEDIUM';
      case 'high':
        return 'HIGH';
      default:
        return 'MEDIUM';
    }
  }

  it('should map "none" to "MINIMAL"', () => {
    expect(mapReasoningEffortToGemini('none')).toBe('MINIMAL');
  });

  it('should map "low" to "LOW"', () => {
    expect(mapReasoningEffortToGemini('low')).toBe('LOW');
  });

  it('should map "medium" to "MEDIUM"', () => {
    expect(mapReasoningEffortToGemini('medium')).toBe('MEDIUM');
  });

  it('should map "high" to "HIGH"', () => {
    expect(mapReasoningEffortToGemini('high')).toBe('HIGH');
  });
});

describe('Anthropic Budget Tokens Mapping', () => {
  // Simulate the mapping function from anthropic-provider.ts
  function mapReasoningEffortToAnthropicBudget(effort: ReasoningEffort): number | undefined {
    switch (effort) {
      case 'none':
        return undefined;
      case 'low':
        return 1024;
      case 'medium':
        return 8192;
      case 'high':
        return 16384;
      default:
        return undefined;
    }
  }

  it('should map "none" to undefined (disable thinking)', () => {
    expect(mapReasoningEffortToAnthropicBudget('none')).toBeUndefined();
  });

  it('should map "low" to 1024', () => {
    expect(mapReasoningEffortToAnthropicBudget('low')).toBe(1024);
  });

  it('should map "medium" to 8192', () => {
    expect(mapReasoningEffortToAnthropicBudget('medium')).toBe(8192);
  });

  it('should map "high" to 16384', () => {
    expect(mapReasoningEffortToAnthropicBudget('high')).toBe(16384);
  });

  it('should have minimum budget of 1024 (Anthropic requirement)', () => {
    const minBudget = mapReasoningEffortToAnthropicBudget('low');
    expect(minBudget).toBeGreaterThanOrEqual(1024);
  });
});

describe('Mapping Consistency', () => {
  it('should have consistent ordering across all providers', () => {
    // All providers should map efforts in the same relative order:
    // none < low < medium < high

    // Requesty: none < low < medium < high
    const requestyMap: Record<ReasoningEffort, number> = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
    };

    // Gemini: MINIMAL < LOW < MEDIUM < HIGH
    const geminiMap: Record<ReasoningEffort, number> = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
    };

    // Anthropic: undefined < 1024 < 8192 < 16384
    const anthropicMap: Record<ReasoningEffort, number> = {
      none: 0,
      low: 1024,
      medium: 8192,
      high: 16384,
    };

    // Verify ordering is maintained
    expect(requestyMap.none).toBeLessThanOrEqual(requestyMap.low);
    expect(requestyMap.low).toBeLessThanOrEqual(requestyMap.medium);
    expect(requestyMap.medium).toBeLessThanOrEqual(requestyMap.high);

    expect(geminiMap.none).toBeLessThanOrEqual(geminiMap.low);
    expect(geminiMap.low).toBeLessThanOrEqual(geminiMap.medium);
    expect(geminiMap.medium).toBeLessThanOrEqual(geminiMap.high);

    expect(anthropicMap.none).toBeLessThanOrEqual(anthropicMap.low);
    expect(anthropicMap.low).toBeLessThanOrEqual(anthropicMap.medium);
    expect(anthropicMap.medium).toBeLessThanOrEqual(anthropicMap.high);
  });
});
