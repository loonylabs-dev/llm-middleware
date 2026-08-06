# MiniMax Provider

OpenAI-compatible Chat Completions against MiniMax's **own** API
(`https://api.minimax.io/v1`), with Bearer auth.

> **Not the only path to MiniMax models.** The same models are reachable via
> **Bedrock** (Converse, native `reasoningContent`) and **Inceptron**
> (OpenRouter-style, `message.reasoning`). Those gateways expose reasoning
> differently — this document is about the direct API, where it arrives inline.

## Setup

```env
MINIMAX_API_KEY=...
MINIMAX_MODEL=MiniMax-M3            # optional, this is the default
MINIMAX_BASE_URL=https://api.minimax.io/v1   # optional
```

```typescript
import { miniMaxProvider } from '@loonylabs/llm-middleware';

const res = await miniMaxProvider.callWithSystemMessage(
  'Summarise this in one sentence: …',
  'You are a careful assistant.',
  { temperature: 0.05, maxTokens: 4096 }
);

res.message.content;    // the answer, WITHOUT the thinking block
res.message.thinking;   // the thinking block, if there was one
res.usage.reasoningTokens;
```

## 🚨 The one thing that makes MiniMax different

**Reasoning arrives inline, as a `<think>…</think>` block inside
`message.content`.** `message` carries exactly `role` and `content` — there is
no `reasoning` field to read it from.

**And it cannot be switched off.** All three of these were verified live
against `MiniMax-M3` on `api.minimax.io/v1`:

| attempt | result |
|---|---|
| `reasoning_effort: 'none'` | HTTP 200, `<think>` still present — with **more** reasoning tokens than the call without it (20 vs 12) |
| `response_format: {type:'json_object'}` | HTTP 200, answer still wrapped in `<think>` |
| system message "no chain-of-thought" | ignored |

This matches what the middleware already recorded for the Bedrock path
(`bedrock-reasoning.factory.ts`: `noop-minimax` — *"always-on interleaved
thinking, no toggle"*). The direct API behaves the same way.

**Consequences, all deliberate:**

- The provider does **not** send `reasoning_effort`. A caller who passes
  `reasoningEffort` gets a `warn` saying it has no effect — a silently dropped
  wish is indistinguishable from a granted one.
- The provider does **not** send `response_format`. It is accepted and does not
  constrain the output; combined with a prompt asking for a JSON *array* it
  would put two contradictory constraints on the model. State the shape in the
  prompt and parse the extracted content.
- `ThinkingExtractorFactory.forModel()` recognises `minimax` and returns the
  ThinkTag extractor. **Without that entry the NoOp extractor applies and the
  model's working notes are prepended to every answer** — measured once at 43 %
  of the response.

## What this cost, before it was found

The consumer that prompted this provider spent an evening on a wrong lead. Its
extraction prompt told the model "no chain-of-thought" and its provider set
`response_format: json_object`; both were silently ignored, and nothing
anywhere recorded what actually went over the wire. The `<think>` block was
only found by dumping one fully rendered request and one raw response by hand.

The lesson is the middleware's, not the consumer's: **a provider should record
what a model actually does, so the next consumer does not have to rediscover
it.**

## Token usage

Richer than Inceptron's:

```jsonc
{
  "prompt_tokens": 183,
  "completion_tokens": 14,
  "total_tokens": 197,
  "total_characters": 0,                              // MiniMax extra, measured 0 in every call
  "completion_tokens_details": { "reasoning_tokens": 12 },
  "prompt_tokens_details": { "cached_tokens": 128 }
}
```

Mapped to `TokenUsage` as `reasoningTokens` and
`cacheMetadata.cacheReadTokens`. **`reasoning_tokens` is part of
`completion_tokens`, not additional to it** — it is reported for visibility and
never added on top. Cost is not computed here; the consumer applies its own
price-per-token.

## Timeout

`300000 ms`, longer than the 180 s of the other OpenAI-compatible providers.
MiniMax always reasons, and the reasoning tokens are produced *before* the
first content token, so time-to-first-answer is longer than for a
non-reasoning model. **Set, not derived** — chosen to match the consumer that
prompted this provider, not measured against a timeout distribution.

## Error codes worth naming

| code | meaning |
|---|---|
| 401 | invalid key (sent as `Authorization: Bearer`) |
| **402** | **empty pay-as-you-go balance OR exhausted token plan** — the two need different fixes, so this gets its own message |
| 404 | model ID unknown, or `MINIMAX_BASE_URL` wrong |
| 429 | rate limit; `retry-after` is logged |

## Tests

- `tests/unit/services/llm/providers/minimax-provider.test.ts` (12)
- The fixtures are shaped after a live probe, not invented — including the
  `<think>` content and the nested `usage` details.
