# Reasoning Control Feature

## Overview

The `reasoningEffort` parameter allows you to control how much "thinking" or "reasoning" a model performs before generating a response. This is particularly useful for:

- **Reducing costs**: Models like Gemini use reasoning tokens by default, which can be expensive
- **Faster responses**: Lower reasoning effort = faster responses
- **Complex tasks**: Higher reasoning effort = better results for complex problems

## Important: Gemini Version Differences

Google changed the reasoning API between Gemini 2.5 and Gemini 3:

| Version | API Parameter | Supported Values |
|---------|---------------|------------------|
| **Gemini 2.5** | `thinking_budget` | Integer (0-24576), `-1` for auto |
| **Gemini 3 Flash** | `thinking_level` | `MINIMAL`, `LOW`, `MEDIUM`, `HIGH` |
| **Gemini 3 Pro** | `thinking_level` | `LOW`, `HIGH` only |

**Provider Support:**
- ✅ **Vertex AI**: Both APIs supported (recommended for EU/CDPA compliance)
- ✅ **Gemini Direct API**: Both APIs supported
- ⚠️ **Requesty**: Only Gemini 2.5 (`thinking_budget`) - Gemini 3 ignores the parameter

## Usage

### Via Requesty (Gemini 2.5)

```typescript
import { LLMService, LLMProvider } from '@loonylabs/llm-middleware';

const llmService = new LLMService();

const response = await llmService.callWithSystemMessage(
  'What is 15 + 27?',
  'You are a helpful assistant.',
  {
    provider: LLMProvider.REQUESTY,
    model: 'google/gemini-2.5-flash',  // Use Gemini 2.5 for Requesty!
    reasoningEffort: 'none',  // <-- Control reasoning here
  }
);
```

### Via Vertex AI (Recommended for EU/CDPA)

```typescript
const response = await llmService.callWithSystemMessage(
  'Solve this complex math problem...',
  'You are a careful reasoning assistant.',
  {
    provider: LLMProvider.VERTEX_AI,
    model: 'gemini-2.5-flash',  // or 'gemini-3-flash-preview'
    reasoningEffort: 'high',
    // region defaults to europe-west3 (Frankfurt)
  }
);
```

**Note:** Gemini 3 Preview models automatically use the global endpoint (no EU data residency). Regional endpoints will be available when Gemini 3 reaches GA.

### Via Direct Google API (Gemini 3)

```typescript
const response = await llmService.callWithSystemMessage(
  'Solve this complex math problem...',
  'You are a careful reasoning assistant.',
  {
    provider: LLMProvider.GOOGLE,
    model: 'gemini-3-flash-preview',
    reasoningEffort: 'high',
  }
);
```

## Available Levels

| Level | Description | Best For |
|-------|-------------|----------|
| `none` | Minimal reasoning (maps to `min` for Gemini) | Simple tasks, fastest responses |
| `low` | Light reasoning | Standard tasks, cost-sensitive |
| `medium` | Balanced (often default) | General use |
| `high` | Deep reasoning | Complex problems, math, logic |

## Provider Mappings

### Requesty (Gemini 2.5 only!)

The `reasoningEffort` maps to `reasoning_effort` → `thinking_budget`:

| reasoningEffort | reasoning_effort | Effect |
|-----------------|------------------|--------|
| `none` | `min` | Minimal thinking |
| `low` | `low` | Light thinking |
| `medium` | `medium` | Balanced |
| `high` | `high` | Deep thinking |

**Supported models via Requesty:**
- `google/gemini-2.5-flash` ✅
- `coding/gemini-2.5-flash@europe-central2` ✅
- `google/gemini-3-flash-preview` ❌ (parameter ignored!)
- `vertex/gemini-3-flash-preview` ❌ (parameter ignored!)

### Vertex AI / Google Gemini Direct API (Gemini 2.5)

The `reasoningEffort` maps to `thinkingConfig.thinkingBudget`:

| reasoningEffort | thinkingBudget | Effect |
|-----------------|----------------|--------|
| `none` | `0` | Thinking disabled |
| `low` | `1024` | Minimal thinking |
| `medium` | `6144` | Balanced |
| `high` | `12288` | Deep thinking |

### Vertex AI / Google Gemini Direct API (Gemini 3)

The `reasoningEffort` maps to `thinkingConfig.thinkingLevel`:

| reasoningEffort | thinking_level | Gemini 3 Flash | Gemini 3 Pro |
|-----------------|----------------|----------------|--------------|
| `none` | `MINIMAL` | ✅ ~0 tokens | ❌ → LOW |
| `low` | `LOW` | ✅ ~0 tokens | ✅ |
| `medium` | `MEDIUM` | ✅ ~1400 tokens | ❌ → LOW |
| `high` | `HIGH` | ✅ ~2000 tokens | ✅ |

**Note:** Gemini 3 cannot fully disable thinking - `none` maps to `MINIMAL` (Flash) or `LOW` (Pro).

### Anthropic Claude

The `reasoningEffort` maps to `thinking.budget_tokens`:

| reasoningEffort | budget_tokens |
|-----------------|---------------|
| `none` | (disabled) |
| `low` | 1024 |
| `medium` | 8192 |
| `high` | 16384 |

Note: Anthropic's Extended Thinking requires a minimum of 1024 tokens.

## Tracking Reasoning Tokens

The middleware now tracks reasoning tokens separately in the response:

```typescript
const response = await llmService.callWithSystemMessage(...);

console.log(response.usage);
// {
//   inputTokens: 49,
//   outputTokens: 540,
//   reasoningTokens: 13143,  // <-- NEW! Thinking tokens
//   totalTokens: 13732
// }
```

This is essential for cost tracking, as reasoning tokens can be 10-50x the output tokens!

## Testing

### Vertex AI Smoke Test

```bash
# Gemini 2.5 (regional endpoint - EU compliant)
npm run test:vertex:smoke gemini-2.5-flash

# Gemini 3 Preview (global endpoint - no EU data residency)
npm run test:vertex:smoke gemini-3-flash-preview
```

### General Reasoning Smoke Test

Run a quick smoke test with CLI arguments:

```bash
# Via Direct Google API (Gemini 3)
npm run test:reasoning:smoke -- google gemini-3-flash-preview

# Via Requesty (Gemini 2.5)
npm run test:reasoning:smoke -- requesty google/gemini-2.5-flash

# Default (uses .env settings)
npm run test:reasoning:smoke
```

### Integration Tests

Run full integration tests (requires `LLM_INTEGRATION_TESTS=true`):

```bash
npm run test:integration:reasoning
```

### Environment Setup

For Vertex AI (recommended):
```bash
GOOGLE_CLOUD_PROJECT=your_project_id
VERTEX_AI_REGION=europe-west3           # Default: Frankfurt
GOOGLE_APPLICATION_CREDENTIALS=./vertex-ai-service-account.json
```

For Requesty:
```bash
REQUESTY_API_KEY=your_api_key_here
```

For Direct Google API:
```bash
GEMINI_API_KEY=your_api_key_here
```

Optional:
```bash
TEST_REASONING_MODEL=google/gemini-2.5-flash
LLM_INTEGRATION_TESTS=true
DEBUG_LLM_REQUESTS=true
```

## Token Usage Comparison

### Gemini 2.5 Flash (Vertex AI)

| reasoningEffort | Output Tokens | Reasoning Tokens | Total | Time |
|-----------------|---------------|------------------|-------|------|
| `none` | ~1500 | 0 | ~4000 | ~8s |
| `low` | ~1400 | ~800 | ~6000 | ~10s |
| `medium` | ~1400 | ~5000-7000 | ~8000 | ~15s |
| `high` | ~1400 | ~8000-10000 | ~12000 | ~20s |

### Gemini 3 Flash Preview (Vertex AI)

| reasoningEffort | Output Tokens | Reasoning Tokens | Total | Time |
|-----------------|---------------|------------------|-------|------|
| `none` (MINIMAL) | ~1500 | 0 | ~1700 | ~11s |
| `low` (LOW) | ~1300 | 0 | ~1500 | ~12s |
| `medium` (MEDIUM) | ~1400 | ~1400 | ~3000 | ~22s |
| `high` (HIGH) | ~1400 | ~2000 | ~3500 | ~25s |

**Note:** Gemini 3 Flash uses less reasoning tokens than Gemini 2.5 for similar tasks. MINIMAL and LOW both produce 0 reasoning tokens.

## Recommendations

1. **For EU/CDPA compliance**: Use `LLMProvider.VERTEX_AI` with regional endpoints
2. **For simple tasks**: Use `reasoningEffort: 'none'` to minimize cost and latency
3. **For Gemini via Requesty**: Use `google/gemini-2.5-flash` (Gemini 3 ignores the parameter)
4. **For Gemini 3 Preview**: Use Vertex AI or Direct Google API (Requesty doesn't support it)
5. **Track costs**: Always check `response.usage.reasoningTokens` for cost analysis

## References

- [Google Gemini Thinking (2.5 vs 3)](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thinking)
- [Requesty Reasoning Docs](https://docs.requesty.ai/features/reasoning)
- [Anthropic Extended Thinking](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)
- [OpenAI Reasoning Effort](https://platform.openai.com/docs/guides/reasoning)
