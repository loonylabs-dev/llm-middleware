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
  `reasoning` and `content` comes back empty.

> The provider **always sends `reasoning_effort`, defaulting to `'none'`** when the
> caller does not specify one. Opt into reasoning by passing
> `reasoningEffort: 'low' | 'medium' | 'high'`.

> ⚠️ **GLM-5.1-FP8 correction (verified 2026-05-30): `'none'` is NOT safe for this
> model — the earlier "explicit effort reliably populates content" note was wrong.**
> At `reasoning_effort: 'none'` GLM-5.1 still reasons internally but **discards the
> visible answer**: `content` comes back `null` with `finish_reason: "stop"` while
> the tokens are burned in `reasoning` (or nothing). Its **effective minimum is
> `'low'`**. Even at `'low'` an occasional empty response still occurs — average
> over multiple samples. See "GLM-5.1-FP8 stability envelope" below.

```typescript
// Reasoning on; thinking text surfaces in response.message.thinking
const res = await llmService.callWithSystemMessage(prompt, system, {
  provider: LLMProvider.INCEPTRON,
  model: 'zai-org/GLM-5.1-FP8',
  reasoningEffort: 'medium'
});
console.log(res?.message.thinking); // the reasoning channel
```

> ⚠️ Reasoning-into-`content` leakage and output degeneration are driven primarily
> by **temperature**, not by the effort level — see the stability envelope below.
> When `content` is empty while `reasoning` is present, the provider logs a warning.

## GLM-5.1-FP8 stability envelope (verified 2026-05-30)

`zai-org/GLM-5.1-FP8` is **sensitive to both temperature and reasoning effort**.
Outside a narrow envelope it degenerates: garbled multi-script output (CJK / Cyrillic
fragments), runaway repetition loops, leaked `<think>…</think>` markers inside
`content`, or `content: null` after a long `reasoning` block. Two independent axes:

**Temperature** — probed at fixed `reasoning_effort: 'low'`, ~250-word German prose,
`max_tokens: 4000`:

| temperature | result |
|---|---|
| 0.3 | 3/3 clean |
| 0.5 | 2/3 clean (1× empty `content`) |
| **0.7** | **3/3 clean** |
| 1.0 | **0/3** — garbage script / repetition loop / empty / leaked `</think>` |

→ The degeneration cliff sits **between 0.7 and 1.0**. Keep GLM-5.1 at
**`temperature ≤ 0.7`**. High-temperature creative settings (`1.0`) reliably break it
— this also explains structured-output failures (a heavy German "concept→JSON" call
at `temperature: 1.0` collapsed mid-reasoning and returned `content: null`).

**Reasoning effort** — `'none'` frequently yields empty `content`; use
**`reasoning_effort ≥ 'low'`** (see correction above).

**Recommended operating envelope:** `temperature ≤ 0.7` **and**
`reasoning_effort ≥ 'low'`. Even inside it, expect an occasional empty response →
average over n > 1.

> The middleware does **not** clamp these itself — it stays model-agnostic. Enforce
> the envelope in the consumer via per-model config (e.g. a `minReasoningEffort` floor
> + `maxTemperature` ceiling clamped onto the request before the call).

## Token usage caveats

The `usage` block returns only `prompt_tokens` / `completion_tokens` /
`total_tokens`:

- **No `reasoning_tokens`** → reasoning tokens are folded into `completion_tokens`
  (like Ollama); `usage.reasoningTokens` is **not** populated.
- **No `cost`** field (unlike Requesty).
- `prompt_tokens_details.cached_tokens` → `usage.cacheMetadata.cacheReadTokens`
  when present. **Implicit prompt caching is active** — verified 2026-05-30 on a
  repeated large prompt: `cached_tokens: 3200` of `prompt_tokens: 3204` (the earlier
  `null` observation was for a cold/short prompt).

## Limitations / follow-ups

- **Vision/image input:** untested; the provider sends OpenAI `image_url` parts
  (same as Requesty) but image support per model is unverified.
- **Tool use:** not wired up.
- **Rate / usage limits:** `429` on rapid bursts (handled by the shared
  `retryWithBackoff`, respects `Retry-After`). After **sustained heavy usage** the
  key may instead start returning **`401`** — observed 2026-05-30 after ~100+ calls
  in a day. This is an **account usage/quota limit on the key, not an auth
  misconfiguration**: wait for the quota window to reset or raise the key tier.
  (Under jsdom the same `401` was previously masked as a generic `ERR_NETWORK` —
  see transport note.)
- **Transport (jsdom / test environments) — fixed in 2.30.1:** axios auto-selects
  the **XHR adapter** whenever `XMLHttpRequest` exists (e.g. a Vitest/Jest
  `environment: 'jsdom'` setup), which fails real external HTTPS with a generic
  **`ERR_NETWORK` ("Network Error", no response)** and masks the real status. The
  provider now pins **`adapter: 'http'`** so it always uses the Node transport.
  Consumers on older versions running under jsdom must either upgrade or switch the
  test environment to `node`.

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
