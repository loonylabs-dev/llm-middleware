/**
 * Unit Tests for Gemini Base Provider Functions
 *
 * Tests the shared logic for Gemini-based providers:
 * - Generation detection (2.5 vs 3.x)
 * - Reasoning effort mapping to thinkingLevel/thinkingBudget
 * - Gemini 3 Pro thinkingLevel fallback (clampThinkingLevelForModel)
 */

import {
  detectGeminiGeneration,
  mapReasoningEffortToThinkingLevel,
  mapReasoningEffortToThinkingBudget,
  isGeminiPro,
  detectGemini3SubVersion,
  clampThinkingLevelForModel,
  GeminiGeneration
} from '../../../../src/middleware/services/llm/providers/gemini';
import { GeminiThinkingLevel } from '../../../../src/middleware/services/llm/types/gemini.types';
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

describe('Gemini Pro Model Detection', () => {
  describe('isGeminiPro', () => {
    it('should detect Gemini 3 Pro models', () => {
      expect(isGeminiPro('gemini-3-pro-preview')).toBe(true);
      expect(isGeminiPro('gemini-3-pro')).toBe(true);
      expect(isGeminiPro('gemini-3.1-pro')).toBe(true);
      expect(isGeminiPro('gemini-3.1-pro-preview')).toBe(true);
    });

    it('should detect Gemini 2.5 Pro models', () => {
      expect(isGeminiPro('gemini-2.5-pro')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isGeminiPro('GEMINI-3-PRO-PREVIEW')).toBe(true);
      expect(isGeminiPro('Gemini-3-Pro')).toBe(true);
    });

    it('should return false for Flash models', () => {
      expect(isGeminiPro('gemini-3-flash-preview')).toBe(false);
      expect(isGeminiPro('gemini-3-flash')).toBe(false);
      expect(isGeminiPro('gemini-3.1-flash')).toBe(false);
      expect(isGeminiPro('gemini-2.5-flash')).toBe(false);
    });

    it('should return false for non-Gemini models', () => {
      expect(isGeminiPro('gpt-4')).toBe(false);
      expect(isGeminiPro('claude-3-opus')).toBe(false);
    });
  });

  describe('detectGemini3SubVersion', () => {
    it('should detect Gemini 3.0 (plain "3")', () => {
      expect(detectGemini3SubVersion('gemini-3-pro-preview')).toBe('3');
      expect(detectGemini3SubVersion('gemini-3-flash-preview')).toBe('3');
      expect(detectGemini3SubVersion('gemini-3-pro')).toBe('3');
      expect(detectGemini3SubVersion('gemini-3-flash')).toBe('3');
    });

    it('should detect Gemini 3.1', () => {
      expect(detectGemini3SubVersion('gemini-3.1-pro')).toBe('3.1');
      expect(detectGemini3SubVersion('gemini-3.1-pro-preview')).toBe('3.1');
      expect(detectGemini3SubVersion('gemini-3.1-flash')).toBe('3.1');
    });

    it('should detect Gemini 3.0 explicit', () => {
      expect(detectGemini3SubVersion('gemini-3.0-pro')).toBe('3.0');
    });

    it('should be case insensitive', () => {
      expect(detectGemini3SubVersion('GEMINI-3-PRO')).toBe('3');
      expect(detectGemini3SubVersion('GEMINI-3.1-PRO')).toBe('3.1');
    });

    it('should return undefined for non-Gemini 3 models', () => {
      expect(detectGemini3SubVersion('gemini-2.5-flash')).toBeUndefined();
      expect(detectGemini3SubVersion('gemini-1.5-pro')).toBeUndefined();
      expect(detectGemini3SubVersion('gpt-4')).toBeUndefined();
    });
  });
});

describe('ThinkingLevel Clamping for Model Constraints', () => {
  describe('clampThinkingLevelForModel', () => {
    // Gemini 3 Flash — all levels supported
    describe('Gemini 3 Flash (all levels supported)', () => {
      const flashModels = ['gemini-3-flash-preview', 'gemini-3-flash', 'gemini-3.1-flash'];

      it.each(flashModels)('should pass through all levels for %s', (model) => {
        expect(clampThinkingLevelForModel('MINIMAL', model)).toBe('MINIMAL');
        expect(clampThinkingLevelForModel('LOW', model)).toBe('LOW');
        expect(clampThinkingLevelForModel('MEDIUM', model)).toBe('MEDIUM');
        expect(clampThinkingLevelForModel('HIGH', model)).toBe('HIGH');
      });
    });

    // Gemini 3.0 Pro — only LOW, HIGH
    describe('Gemini 3.0 Pro (only LOW, HIGH)', () => {
      const proModels = ['gemini-3-pro-preview', 'gemini-3-pro'];

      it.each(proModels)('should clamp MINIMAL to LOW for %s', (model) => {
        expect(clampThinkingLevelForModel('MINIMAL', model)).toBe('LOW');
      });

      it.each(proModels)('should clamp MEDIUM to LOW for %s', (model) => {
        expect(clampThinkingLevelForModel('MEDIUM', model)).toBe('LOW');
      });

      it.each(proModels)('should pass through LOW for %s', (model) => {
        expect(clampThinkingLevelForModel('LOW', model)).toBe('LOW');
      });

      it.each(proModels)('should pass through HIGH for %s', (model) => {
        expect(clampThinkingLevelForModel('HIGH', model)).toBe('HIGH');
      });
    });

    // Gemini 3.1 Pro — LOW, MEDIUM, HIGH (no MINIMAL)
    describe('Gemini 3.1 Pro (LOW, MEDIUM, HIGH)', () => {
      const pro31Models = ['gemini-3.1-pro', 'gemini-3.1-pro-preview'];

      it.each(pro31Models)('should clamp MINIMAL to LOW for %s', (model) => {
        expect(clampThinkingLevelForModel('MINIMAL', model)).toBe('LOW');
      });

      it.each(pro31Models)('should pass through MEDIUM for %s', (model) => {
        expect(clampThinkingLevelForModel('MEDIUM', model)).toBe('MEDIUM');
      });

      it.each(pro31Models)('should pass through LOW for %s', (model) => {
        expect(clampThinkingLevelForModel('LOW', model)).toBe('LOW');
      });

      it.each(pro31Models)('should pass through HIGH for %s', (model) => {
        expect(clampThinkingLevelForModel('HIGH', model)).toBe('HIGH');
      });
    });

    // Edge cases
    describe('edge cases', () => {
      it('should handle THINKING_LEVEL_UNSPECIFIED without clamping', () => {
        expect(clampThinkingLevelForModel('THINKING_LEVEL_UNSPECIFIED', 'gemini-3-pro')).toBe('THINKING_LEVEL_UNSPECIFIED');
        expect(clampThinkingLevelForModel('THINKING_LEVEL_UNSPECIFIED', 'gemini-3-flash')).toBe('THINKING_LEVEL_UNSPECIFIED');
      });

      it('should handle case-insensitive model names', () => {
        expect(clampThinkingLevelForModel('MINIMAL', 'GEMINI-3-PRO-PREVIEW')).toBe('LOW');
        expect(clampThinkingLevelForModel('MEDIUM', 'GEMINI-3-PRO')).toBe('LOW');
      });
    });
  });

  // Integration: full mapping chain (reasoningEffort → thinkingLevel → clamped)
  describe('Full mapping chain: reasoningEffort → clamped thinkingLevel', () => {
    it('should produce correct levels for Gemini 3 Flash', () => {
      const model = 'gemini-3-flash-preview';
      const map = (effort: ReasoningEffort) =>
        clampThinkingLevelForModel(mapReasoningEffortToThinkingLevel(effort), model);

      expect(map('none')).toBe('MINIMAL');
      expect(map('low')).toBe('LOW');
      expect(map('medium')).toBe('MEDIUM');
      expect(map('high')).toBe('HIGH');
    });

    it('should produce correct levels for Gemini 3.0 Pro', () => {
      const model = 'gemini-3-pro-preview';
      const map = (effort: ReasoningEffort) =>
        clampThinkingLevelForModel(mapReasoningEffortToThinkingLevel(effort), model);

      expect(map('none')).toBe('LOW');    // MINIMAL → LOW
      expect(map('low')).toBe('LOW');
      expect(map('medium')).toBe('LOW');  // MEDIUM → LOW
      expect(map('high')).toBe('HIGH');
    });

    it('should produce correct levels for Gemini 3.1 Pro', () => {
      const model = 'gemini-3.1-pro';
      const map = (effort: ReasoningEffort) =>
        clampThinkingLevelForModel(mapReasoningEffortToThinkingLevel(effort), model);

      expect(map('none')).toBe('LOW');    // MINIMAL → LOW
      expect(map('low')).toBe('LOW');
      expect(map('medium')).toBe('MEDIUM'); // supported on 3.1 Pro!
      expect(map('high')).toBe('HIGH');
    });
  });
});
