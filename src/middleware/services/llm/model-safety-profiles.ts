/**
 * Declarative per-model safety profiles.
 *
 * Some models have an **intrinsic safe operating envelope**: outside it they
 * degenerate (garbled multi-script output, runaway repetition, empty content,
 * leaked reasoning markers). That is a property of the *model / serving stack*,
 * independent of any consumer — so the knowledge lives here in the middleware and
 * is enforced centrally in `LLMService` for **every** provider.
 *
 * This is **not** for API-format differences between models/providers (those live
 * in the providers, e.g. Gemini 2.5 `thinkingBudget` vs 3.x `thinkingLevel`). It is
 * *only* for "this model misbehaves outside these bounds" safety clamps:
 *   - `minReasoningEffort` — the effort is raised UP to this floor.
 *   - `maxTemperature`     — the temperature is lowered DOWN to this ceiling.
 *
 * Consumers may still pass stricter values; the clamp only ever moves a value
 * toward the safe envelope, never the other way.
 */
import { ReasoningEffort } from './types';

export interface ModelSafetyProfile {
  /** Case-insensitive substring matched against the model id. */
  match: string;
  /** Effort floor — a lower (or unset) requested effort is raised to this. */
  minReasoningEffort?: ReasoningEffort;
  /** Temperature ceiling — a higher requested temperature is lowered to this. */
  maxTemperature?: number;
  /** Short human-readable rationale (logged when a clamp fires). */
  note?: string;
}

/** Ascending order used to compare reasoning-effort levels. */
const REASONING_ORDER: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];

/**
 * Known-fragile models. Keep entries small, evidence-based, and documented
 * (link the verifying notes in the provider doc).
 */
export const MODEL_SAFETY_PROFILES: ModelSafetyProfile[] = [
  {
    // GLM-5.1-FP8 (Inceptron). Verified 2026-05-30 (see docs/INCEPTRON.md):
    //  - reasons even at reasoning_effort='none' and discards the answer → content
    //    null; effective floor is 'low'.
    //  - degenerates into garbage/repetition/empty/leaked <think> at temperature
    //    >= 1.0; stable at <= 0.7.
    match: 'glm-5.1',
    minReasoningEffort: 'low',
    maxTemperature: 0.7,
    note: 'GLM-5.1 returns empty content at reasoning=none and degenerates at temperature>=1.0',
  },
];

/** Find the first safety profile whose `match` is a substring of the model id. */
export function findModelSafetyProfile(model?: string): ModelSafetyProfile | undefined {
  if (!model) return undefined;
  const m = model.toLowerCase();
  return MODEL_SAFETY_PROFILES.find((p) => m.includes(p.match.toLowerCase()));
}

export interface SafetyClampResult {
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
  /** What was changed (for logging). Empty object = no clamp fired. */
  clamped: {
    reasoningEffort?: { from?: ReasoningEffort; to: ReasoningEffort };
    temperature?: { from: number; to: number };
  };
  profile?: ModelSafetyProfile;
}

/**
 * Apply the matching model's safety profile to a (model, temperature,
 * reasoningEffort) set. Pure — performs no I/O and never throws. Returns the
 * (possibly adjusted) values plus a record of what changed; the caller logs.
 *
 * - Reasoning floor applies even when `reasoningEffort` is undefined (a fragile
 *   model must not run below its floor just because the caller omitted it).
 * - Temperature ceiling only applies when a temperature is set (undefined =
 *   provider default, left untouched).
 */
export function applyModelSafetyProfile(opts: {
  model?: string;
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
}): SafetyClampResult {
  const profile = findModelSafetyProfile(opts.model);
  const result: SafetyClampResult = {
    temperature: opts.temperature,
    reasoningEffort: opts.reasoningEffort,
    clamped: {},
    profile,
  };
  if (!profile) return result;

  if (profile.minReasoningEffort) {
    const floorIdx = REASONING_ORDER.indexOf(profile.minReasoningEffort);
    const curIdx = result.reasoningEffort === undefined
      ? 0 // undefined behaves as the weakest effort ('none')
      : REASONING_ORDER.indexOf(result.reasoningEffort);
    if (floorIdx >= 0 && curIdx < floorIdx) {
      result.clamped.reasoningEffort = { from: result.reasoningEffort, to: profile.minReasoningEffort };
      result.reasoningEffort = profile.minReasoningEffort;
    }
  }

  if (profile.maxTemperature !== undefined
    && result.temperature !== undefined
    && result.temperature > profile.maxTemperature) {
    result.clamped.temperature = { from: result.temperature, to: profile.maxTemperature };
    result.temperature = profile.maxTemperature;
  }

  return result;
}
