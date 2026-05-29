import {
  BedrockReasoningFactory,
  ReasoningEffortStrategy,
  NovaReasoningStrategy,
  NoOpReasoningStrategy
} from '../../../../../src/middleware/services/llm/providers/bedrock-reasoning';

describe('Bedrock reasoning strategies', () => {
  describe('ReasoningEffortStrategy', () => {
    const strategy = new ReasoningEffortStrategy();

    it.each(['low', 'medium', 'high'] as const)('maps %s to reasoning_effort', (effort) => {
      const result = strategy.apply(effort);
      expect(result.additionalModelRequestFields).toEqual({ reasoning_effort: effort });
      expect(result.removeInferenceConfigKeys).toBeUndefined();
      expect(result.promptSuffix).toBeUndefined();
    });

    it("emits no field for 'none' but warns it has no reliable effect", () => {
      const result = strategy.apply('none');
      expect(result.additionalModelRequestFields).toBeUndefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });
  });

  describe('NovaReasoningStrategy', () => {
    const strategy = new NovaReasoningStrategy();

    it('maps low/medium to an enabled reasoningConfig without constraint removal', () => {
      const result = strategy.apply('medium');
      expect(result.additionalModelRequestFields).toEqual({
        reasoningConfig: { type: 'enabled', maxReasoningEffort: 'medium' }
      });
      expect(result.removeInferenceConfigKeys).toBeUndefined();
    });

    it("disables reasoning for 'none'", () => {
      const result = strategy.apply('none');
      expect(result.additionalModelRequestFields).toEqual({
        reasoningConfig: { type: 'disabled' }
      });
    });

    it("removes the forbidden inference keys at 'high' and warns", () => {
      const result = strategy.apply('high');
      expect(result.additionalModelRequestFields).toEqual({
        reasoningConfig: { type: 'enabled', maxReasoningEffort: 'high' }
      });
      expect(result.removeInferenceConfigKeys).toEqual(
        expect.arrayContaining(['temperature', 'topP', 'maxTokens'])
      );
      expect(result.warnings?.length).toBeGreaterThan(0);
    });
  });

  describe('NoOpReasoningStrategy', () => {
    it('applies no request fields and surfaces the reason as a warning', () => {
      const result = new NoOpReasoningStrategy('test reason here').apply('high');
      expect(result.additionalModelRequestFields).toBeUndefined();
      expect(result.warnings?.[0]).toContain('test reason here');
    });
  });

  describe('BedrockReasoningFactory.forModel', () => {
    it('routes open-weight models to the reasoning_effort strategy', () => {
      const openWeight = [
        'qwen.qwen3-32b-v1:0',
        'moonshotai.kimi-k2.5',
        'openai.gpt-oss-120b-1:0',
        'zai.glm-5',
        'zai.glm-4.7-flash',
        'deepseek.v3.2'
      ];
      for (const model of openWeight) {
        expect(BedrockReasoningFactory.forModel(model).name).toBe('reasoning_effort');
      }
    });

    it('routes Nova to the reasoningConfig strategy', () => {
      expect(BedrockReasoningFactory.forModel('eu.amazon.nova-2-lite-v1:0').name).toBe('nova-reasoningConfig');
    });

    it('routes MiniMax and Claude to no-op strategies', () => {
      expect(BedrockReasoningFactory.forModel('minimax.minimax-m2.5').name).toBe('noop-minimax');
      expect(BedrockReasoningFactory.forModel('anthropic.claude-haiku-4-5-20251001-v1:0').name).toBe('noop-claude');
    });
  });
});
