import {
  applyModelSafetyProfile,
  findModelSafetyProfile,
} from '../../../../src/middleware/services/llm/model-safety-profiles';
import { LLMService } from '../../../../src/middleware/services/llm/llm.service';
import { LLMProvider } from '../../../../src/middleware/services/llm/types';

describe('model-safety-profiles — applyModelSafetyProfile (pure)', () => {
  it('lowers temperature down to the GLM-5.1 ceiling (0.7)', () => {
    const r = applyModelSafetyProfile({ model: 'zai-org/GLM-5.1-FP8', temperature: 1.0, reasoningEffort: 'low' });
    expect(r.temperature).toBe(0.7);
    expect(r.clamped.temperature).toEqual({ from: 1.0, to: 0.7 });
  });

  it('raises reasoning_effort up to the GLM-5.1 floor (none → low)', () => {
    const r = applyModelSafetyProfile({ model: 'zai-org/GLM-5.1-FP8', temperature: 0.5, reasoningEffort: 'none' });
    expect(r.reasoningEffort).toBe('low');
    expect(r.clamped.reasoningEffort).toEqual({ from: 'none', to: 'low' });
  });

  it('injects the floor even when reasoning_effort is undefined', () => {
    const r = applyModelSafetyProfile({ model: 'zai-org/GLM-5.1-FP8', temperature: 0.5 });
    expect(r.reasoningEffort).toBe('low');
    expect(r.clamped.reasoningEffort).toEqual({ from: undefined, to: 'low' });
  });

  it('does NOT lower a reasoning_effort already above the floor', () => {
    const r = applyModelSafetyProfile({ model: 'zai-org/GLM-5.1-FP8', temperature: 0.5, reasoningEffort: 'medium' });
    expect(r.reasoningEffort).toBe('medium');
    expect(r.clamped.reasoningEffort).toBeUndefined();
  });

  it('does NOT raise a temperature already below the ceiling', () => {
    const r = applyModelSafetyProfile({ model: 'zai-org/GLM-5.1-FP8', temperature: 0.3, reasoningEffort: 'low' });
    expect(r.temperature).toBe(0.3);
    expect(r.clamped.temperature).toBeUndefined();
  });

  it('leaves temperature untouched when unset (provider default)', () => {
    const r = applyModelSafetyProfile({ model: 'zai-org/GLM-5.1-FP8', reasoningEffort: 'low' });
    expect(r.temperature).toBeUndefined();
    expect(r.clamped.temperature).toBeUndefined();
  });

  it('is a no-op for an unprofiled model', () => {
    const r = applyModelSafetyProfile({ model: 'gemini-3-flash-preview', temperature: 1.3, reasoningEffort: 'none' });
    expect(r.temperature).toBe(1.3);
    expect(r.reasoningEffort).toBe('none');
    expect(r.clamped).toEqual({});
    expect(r.profile).toBeUndefined();
  });

  it('matches the model id case-insensitively as a substring', () => {
    expect(findModelSafetyProfile('ZAI-ORG/glm-5.1-fp8')?.match).toBe('glm-5.1');
    expect(findModelSafetyProfile('zai/GLM-5')).toBeUndefined(); // GLM-5 != GLM-5.1
    expect(findModelSafetyProfile(undefined)).toBeUndefined();
  });
});

describe('model-safety-profiles — LLMService enforces at the chokepoint', () => {
  it('clamps options before dispatching to the provider', async () => {
    const service = new LLMService();
    const captured: any[] = [];
    const fakeProvider: any = {
      callWithSystemMessage: jest.fn(async (_p: unknown, _s: unknown, opts: unknown) => {
        captured.push(opts);
        return { message: { content: 'ok' } };
      }),
    };
    jest.spyOn(service, 'getProvider').mockReturnValue(fakeProvider);

    await service.callWithSystemMessage('prompt', 'system', {
      provider: LLMProvider.INCEPTRON,
      model: 'zai-org/GLM-5.1-FP8',
      temperature: 1.0,
      reasoningEffort: 'none',
    });

    expect(captured[0].temperature).toBe(0.7);
    expect(captured[0].reasoningEffort).toBe('low');
  });

  it('passes through options unchanged for an unprofiled model', async () => {
    const service = new LLMService();
    const captured: any[] = [];
    const fakeProvider: any = {
      call: jest.fn(async (_p: unknown, opts: unknown) => {
        captured.push(opts);
        return { message: { content: 'ok' } };
      }),
    };
    jest.spyOn(service, 'getProvider').mockReturnValue(fakeProvider);

    await service.call('prompt', {
      provider: LLMProvider.VERTEX_AI,
      model: 'gemini-3-flash-preview',
      temperature: 1.0,
    });

    expect(captured[0].temperature).toBe(1.0);
    expect(captured[0].reasoningEffort).toBeUndefined();
  });
});
