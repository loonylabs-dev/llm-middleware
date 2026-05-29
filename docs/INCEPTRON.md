# Inceptron Provider

The Inceptron provider integrates [Inceptron](https://www.inceptron.io/) — a
compiler-accelerated inference platform from **Inceptron AB (Lund, Sweden)** that
serves curated **open-weight models** (GLM-5.1, Kimi, DeepSeek, gpt-oss, MiniMax,
Llama, …) — through the **OpenAI-compatible Chat Completions API**, authenticated
with a **Bearer token**. The request/response shape mirrors the Requesty provider.

- Provider id: `LLMProvider.INCEPTRON` (`'inceptron'`)
- Endpoint: `{INCEPTRON_BASE_URL}/chat/completions` (default `https://openrouter.inceptron.io/v1`)
- Source: `src/middleware/services/llm/providers/inceptron-provider.ts`
- Types: `src/middleware/services/llm/types/inceptron.types.ts`

## Setup

```bash
# .env
INCEPTRON_API_KEY=...                                   # Bearer token (Authorization header)
INCEPTRON_BASE_URL=https://openrouter.inceptron.io/v1   # from the dashboard quickstart
INCEPTRON_MODEL=zai-org/GLM-5.1-FP8                     # default model id (EU-resident)
```

Create the key in the **dashboard → account section**. Copy the **exact model id**
from the model's page in the dashboard — they include a quantization suffix
(`zai-org/GLM-5.1-FP8`, *not* `zai-org/GLM-5`).

```typescript
import { llmService, LLMProvider } from '@loonylabs/llm-middleware';

const res = await llmService.callWithSystemMessage(
  'Summarize the CAP theorem in two sentences.',
  'You are a concise assistant.',
  { provider: LLMProvider.INCEPTRON, model: 'zai-org/GLM-5.1-FP8' }
);
```

## Base URL: two hosts

| Host | Source | Notes |
|---|---|---|
| **`https://openrouter.inceptron.io/v1`** | dashboard quickstart | OpenRouter-style routing layer for the curated models. **Verified working.** Default. |
| `https://api.inceptron.io/v1` | public docs | Documented but not used by the dashboard quickstart for these models. |

The provider defaults to the dashboard host. Override via `INCEPTRON_BASE_URL` or
the `baseUrl` option if Inceptron directs you to a different host.

## EU data residency & DPA

Residency on Inceptron is **per-model**, not a global account toggle, and **does
not depend on which model you pick within the EU set** (data handling is uniform
per their ToS). The model's dashboard page states its residency explicitly:

| Model | Residency (per dashboard) |
|---|---|
| **GLM-5.1** (`zai-org/GLM-5.1-FP8`) | **EU** (`Regions: Europe`), ISO 27001, "No training on user data" |

Key facts (from the Privacy Policy / ToS, read 2026-05-29):

- **Default is *not* EU-only.** The Privacy Policy: *"We may process data in the
  EU, UK, or USA."* EU residency applies when an EU region/model is selected
  (e.g. GLM-5.1 is EU-resident).
- **Zero-retention by default:** prompts/outputs are not logged; API payloads are
  discarded immediately after processing unless you opt in.
- **Sub-processors:** AWS, Azure, GCP or Nebius (Inceptron runs on third-party
  cloud infra, not its own hardware).
- **DPA & SCCs available on request** (`support@inceptron.io`) for B2B/API
  customers — **required for formal GDPR processor coverage**.

> ⚠️ For a DSGVO-grade setup equivalent to Vertex-EU / Azure Data Zone, you must
> (a) use an **EU-resident model** (e.g. GLM-5.1) and (b) **sign the DPA**.
> Out-of-the-box self-service gives you zero-retention but **no contractual EU
> residency guarantee**.

## Reasoning control (verified live)

GLM-5.1 is a reasoning model. Verified live against `zai-org/GLM-5.1-FP8`:

- **`reasoning_effort` accepts `none` / `low` / `medium` / `high`** (no HTTP 400) —
  the provider-agnostic `reasoningEffort` maps **1:1**.
- **Reasoning text returns in `message.reasoning`** (OpenRouter style — *not*
  `reasoning_content` or `thinking`). The provider maps it to the
  provider-agnostic **`message.thinking`**.
- **`message.content` can be `null`.** When `reasoning_effort` is **omitted**, the
  visible answer is **non-deterministic** — sometimes the whole answer stays in
  `reasoning` and `content` comes back empty. **Setting an explicit effort (even
  `none`) reliably populates `content`.**

> The provider therefore **always sends `reasoning_effort`, defaulting to
> `'none'`** when the caller does not specify one. `'none'` = clean, fast,
> deterministic content with no reasoning-token overhead. Opt into reasoning by
> passing `reasoningEffort: 'low' | 'medium' | 'high'`.

```typescript
// Reasoning on; thinking text surfaces in response.message.thinking
const res = await llmService.callWithSystemMessage(prompt, system, {
  provider: LLMProvider.INCEPTRON,
  model: 'zai-org/GLM-5.1-FP8',
  reasoningEffort: 'medium'
});
console.log(res?.message.thinking); // the reasoning channel
```

> ⚠️ At `reasoning_effort: 'high'`, GLM-5.1 occasionally leaks reasoning into
> `content`. If `content` comes back empty while `reasoning` is present, the
> provider emits a warning; prefer `'none'`/`'medium'` or raise `maxTokens`.

## Token usage caveats

The `usage` block returns only `prompt_tokens` / `completion_tokens` /
`total_tokens`:

- **No `reasoning_tokens`** → reasoning tokens are folded into `completion_tokens`
  (like Ollama); `usage.reasoningTokens` is **not** populated.
- **No `cost`** field (unlike Requesty).
- `prompt_tokens_details.cached_tokens` → `usage.cacheMetadata.cacheReadTokens`
  when present (caching is priced on the dashboard but was observed as `null` in
  testing).

## Limitations / follow-ups

- **Vision/image input:** untested; the provider sends OpenAI `image_url` parts
  (same as Requesty) but image support per model is unverified.
- **Tool use:** not wired up.
- **Rate limits:** `429` occurs on rapid successive calls; handled by the shared
  `retryWithBackoff` (respects `Retry-After`).

## Testing

```bash
# Unit tests (mocked axios)
npx jest inceptron-provider

# Live smoke test (needs INCEPTRON_API_KEY in .env)
npm run test:provider:inceptron
# On Windows/cmd, the env-prefixed npm script may not resolve; run directly:
#   TEST_PROVIDER=inceptron npx ts-node tests/manual/provider-smoke-test.ts

# Raw API probe (raw wire format, reasoning field, usage dump)
npx ts-node tests/manual/inceptron-probe.ts
```
