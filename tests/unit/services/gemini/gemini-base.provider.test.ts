/**
 * Unit Tests for Gemini Base Provider Functions
 *
 * Tests the shared logic for Gemini-based providers:
 * - Generation detection (2.5 vs 3.x)
 * - Reasoning effort mapping to thinkingLevel/thinkingBudget
 */

import {
  detectGeminiGeneration,
  mapReasoningEffortToThinkingLevel,
  mapReasoningEffortToThinkingBudget,
  GeminiGeneration
} from '../../../../src/middleware/services/llm/providers/gemini';
import { ReasoningEffort } from '../../../../src/middleware/services/llm/types';

describe('Gemini Generation Detection', () => {
  describe('detectGeminiGeneration', () => {
    it('should detect Gemini 3.x models', () => {
      expect(detectGeminiGeneration('gemini-3-flash-preview')).toBe('3');
      expect(detectGeminiGeneration('gemini-3-pro')).toBe('3');
      expect(detectGeminiGeneration('gemini-3.0-flash')).toBe('3');
      expect(detectGeminiGeneration('GEMINI-3-FLASH')).toBe('3'); // case insensitive
    });

    it('should detect Gemini 2.5 models', () => {
      expect(detectGeminiGeneration('gemini-2.5-flash')).toBe('2.5');
      expect(detectGeminiGeneration('gemini-2.5-flash-lite')).toBe('2.5');
      expect(detectGeminiGeneration('gemini-2.5-pro')).toBe('2.5');
      expect(detectGeminiGeneration('GEMINI-2.5-FLASH')).toBe('2.5'); // case insensitive
    });

    it('should return undefined for non-reasoning models', () => {
      expect(detectGeminiGeneration('gemini-1.5-pro')).toBeUndefined();
      expect(detectGeminiGeneration('gemini-2.0-flash')).toBeUndefined();
      expect(detectGeminiGeneration('gemini-1.5-flash')).toBeUndefined();
      expect(detectGeminiGeneration('gpt-4')).toBeUndefined();
      expect(detectGeminiGeneration('claude-3-opus')).toBeUndefined();
    });
  });
});

describe('Reasoning Effort Mapping - Gemini 3.x (thinkingLevel)', () => {
  describe('mapReasoningEffortToThinkingLevel', () => {
    it('should map "none" to "MINIMAL"', () => {
      expect(mapReasoningEffortToThinkingLevel('none')).toBe('MINIMAL');
    });

    it('should map "low" to "LOW"', () => {
      expect(mapReasoningEffortToThinkingLevel('low')).toBe('LOW');
    });

    it('should map "medium" to "MEDIUM"', () => {
      expect(mapReasoningEffortToThinkingLevel('medium')).toBe('MEDIUM');
    });

    it('should map "high" to "HIGH"', () => {
      expect(mapReasoningEffortToThinkingLevel('high')).toBe('HIGH');
    });

    it('should have valid ordering (MINIMAL < LOW < MEDIUM < HIGH)', () => {
      const levels = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'];
      const efforts: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];

      const mappedLevels = efforts.map(e => mapReasoningEffortToThinkingLevel(e));

      // Verify ordering is preserved
      for (let i = 0; i < mappedLevels.length; i++) {
        expect(levels.indexOf(mappedLevels[i])).toBe(i);
      }
    });
  });
});

describe('Reasoning Effort Mapping - Gemini 2.5 (thinkingBudget)', () => {
  describe('mapReasoningEffortToThinkingBudget', () => {
    it('should map "none" to 0 (disabled)', () => {
      expect(mapReasoningEffortToThinkingBudget('none')).toBe(0);
    });

    it('should map "low" to 1024', () => {
      expect(mapReasoningEffortToThinkingBudget('low')).toBe(1024);
    });

    it('should map "medium" to 6144', () => {
      expect(mapReasoningEffortToThinkingBudget('medium')).toBe(6144);
    });

    it('should map "high" to 12288', () => {
      expect(mapReasoningEffortToThinkingBudget('high')).toBe(12288);
    });

    it('should have increasing budget for higher effort levels', () => {
      const efforts: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];
      const budgets = efforts.map(e => mapReasoningEffortToThinkingBudget(e));

      // Verify strictly increasing
      for (let i = 1; i < budgets.length; i++) {
        expect(budgets[i]).toBeGreaterThan(budgets[i - 1]);
      }
    });

    it('should not exceed maximum budget (12288)', () => {
      const efforts: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];
      efforts.forEach(effort => {
        const budget = mapReasoningEffortToThinkingBudget(effort);
        expect(budget).toBeLessThanOrEqual(12288);
      });
    });
  });
});

describe('Mapping Consistency Between Gemini Versions', () => {
  it('should have consistent ordering across both mapping functions', () => {
    const efforts: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];

    // Both mappings should produce increasing values for increasing effort
    const thinkingLevelOrder: Record<string, number> = {
      'MINIMAL': 0,
      'LOW': 1,
      'MEDIUM': 2,
      'HIGH': 3
    };

    const levels = efforts.map(e => thinkingLevelOrder[mapReasoningEffortToThinkingLevel(e)]);
    const budgets = efforts.map(e => mapReasoningEffortToThinkingBudget(e));

    // Both should be monotonically increasing
    for (let i = 1; i < efforts.length; i++) {
      expect(levels[i]).toBeGreaterThan(levels[i - 1]);
      expect(budgets[i]).toBeGreaterThan(budgets[i - 1]);
    }
  });

  it('should map "none" to minimum/disabled in both versions', () => {
    expect(mapReasoningEffortToThinkingLevel('none')).toBe('MINIMAL');
    expect(mapReasoningEffortToThinkingBudget('none')).toBe(0);
  });

  it('should map "high" to maximum in both versions', () => {
    expect(mapReasoningEffortToThinkingLevel('high')).toBe('HIGH');
    expect(mapReasoningEffortToThinkingBudget('high')).toBe(12288);
  });
});
