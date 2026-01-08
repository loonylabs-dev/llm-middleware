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
| **Gemini 3** | `thinking_level` | `LOW`, `HIGH` (cannot be disabled!) |

**Requesty** currently only supports `thinking_budget` (Gemini 2.5). For Gemini 3, use the **Direct Google API**.

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

### Google Gemini Direct API (Gemini 3)

The `reasoningEffort` maps to `thinkingConfig.thinkingLevel`:

| reasoningEffort | thinking_level |
|-----------------|----------------|
| `none` | `MINIMAL` |
| `low` | `LOW` |
| `medium` | `MEDIUM` |
| `high` | `HIGH` |

**Note:** Gemini 3 cannot fully disable thinking - `none` maps to `MINIMAL`.

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

### Smoke Test

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

For Requesty:
```
REQUESTY_API_KEY=your_api_key_here
```

For Direct Google API:
```
GEMINI_API_KEY=your_api_key_here
```

Optional:
```
TEST_REASONING_MODEL=google/gemini-2.5-flash
LLM_INTEGRATION_TESTS=true
DEBUG_LLM_REQUESTS=true
```

## Token Usage Comparison

Example with Gemini 3 Flash (Direct API) for a math problem:

| reasoningEffort | Output Tokens | Reasoning Tokens | Total | Time |
|-----------------|---------------|------------------|-------|------|
| `none` (MINIMAL) | ~200 | ~500 | ~750 | ~2s |
| `low` | ~250 | ~3000 | ~3300 | ~15s |
| `medium` | ~280 | ~8000 | ~8330 | ~40s |
| `high` | ~540 | ~13000 | ~13600 | ~80s |

The reasoning tokens dominate the total cost for complex tasks!

## Recommendations

1. **For simple tasks**: Use `reasoningEffort: 'none'` to minimize cost and latency
2. **For Gemini via Requesty**: Use `google/gemini-2.5-flash` (Gemini 3 ignores the parameter)
3. **For Gemini 3**: Use Direct Google API (`LLMProvider.GOOGLE`)
4. **Track costs**: Always check `response.usage.reasoningTokens` for cost analysis

## References

- [Google Gemini Thinking (2.5 vs 3)](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thinking)
- [Requesty Reasoning Docs](https://docs.requesty.ai/features/reasoning)
- [Anthropic Extended Thinking](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking)
- [OpenAI Reasoning Effort](https://platform.openai.com/docs/guides/reasoning)
