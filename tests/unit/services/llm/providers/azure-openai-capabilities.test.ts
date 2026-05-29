import {
  isAzureReasoningModel,
  mapAzureReasoningEffort
} from '../../../../../src/middleware/services/llm/providers/azure-openai-capabilities';

describe('azure-openai-capabilities', () => {
  describe('isAzureReasoningModel — name heuristic', () => {
    it.each([
      'o1', 'o1-mini', 'o3', 'o3-mini', 'o3-pro', 'o4-mini',
      'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.1', 'gpt-5-codex', 'codex-mini'
    ])('detects reasoning model: %s', (name) => {
      expect(isAzureReasoningModel(name)).toBe(true);
    });

    it.each([
      'gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-4-turbo', 'gpt-35-turbo',
      'neo4j', 'my-chat-model', 'mistral-large', ''
    ])('treats as standard model: %s', (name) => {
      expect(isAzureReasoningModel(name)).toBe(false);
    });

    it('detects reasoning model in a prefixed/suffixed deployment name', () => {
      expect(isAzureReasoningModel('prod-o4-mini-eu')).toBe(true);
      expect(isAzureReasoningModel('team.gpt-5.deploy')).toBe(true);
    });
  });

  describe('isAzureReasoningModel — explicit override', () => {
    it('override=true wins over a standard-looking name', () => {
      expect(isAzureReasoningModel('my-custom-deploy', true)).toBe(true);
    });

    it('override=false wins over a reasoning-looking name', () => {
      expect(isAzureReasoningModel('o4-mini', false)).toBe(false);
    });
  });

  describe('mapAzureReasoningEffort', () => {
    it.each(['low', 'medium', 'high'] as const)('passes %s through', (effort) => {
      expect(mapAzureReasoningEffort(effort)).toEqual({ value: effort });
    });

    it("omits 'none' with a warning", () => {
      const result = mapAzureReasoningEffort('none');
      expect(result.value).toBeUndefined();
      expect(result.warning).toMatch(/none/);
    });
  });
});
