# Azure OpenAI / Microsoft Foundry Provider

The Azure provider integrates Azure OpenAI / Microsoft Foundry models through the
**OpenAI-compatible Chat Completions API** using the new **v1 route**, authenticated
with an **Azure API key in the `api-key` header**. The request/response shape is
identical to a standard OpenAI call, so it mirrors the Requesty provider.

- Provider id: `LLMProvider.AZURE_OPENAI` (`'azure_openai'`)
- Endpoint: `{AZURE_OPENAI_ENDPOINT}/openai/v1/chat/completions`
- Source: `src/middleware/services/llm/providers/azure-openai-provider.ts`
- Types: `src/middleware/services/llm/types/azure-openai.types.ts`
- Capabilities helper: `src/middleware/services/llm/providers/azure-openai-capabilities.ts`

## Why the v1 route + api-key

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| API surface | **v1** (`/openai/v1/chat/completions`) | classic (`/openai/deployments/{name}/…?api-version=`) | v1 sends the deployment name as the body `model` field and makes `api-version` optional — payload identical to OpenAI, no api-version to maintain. Microsoft is steering everyone here (the Azure AI Inference SDK is being retired in favor of OpenAI/v1). |
| Auth | **API key** (`api-key` header) | Microsoft Entra ID (`Authorization: Bearer`) | Matches the key-based pattern of every other provider (no extra SDK). Entra ID OAuth is a planned follow-up. |

> ⚠️ **Azure-specific:** the API key goes in the **`api-key` header**, *not*
> `Authorization: Bearer` (which Azure reserves for Entra ID tokens). This differs
> from the Bedrock/Vertex providers. Verified live.

## Concepts: deployment vs. model

Unlike Bedrock/Vertex (where you call a model id directly), Azure uses
**deployments**: you deploy a catalog model once in the portal under a chosen
**deployment name**, then call that name. With serverless (`Global Standard` /
`Data Zone Standard`) deployments this is pay-per-token — no infrastructure to
manage. At call time it is as simple as Bedrock/Vertex; the deployment name is
sent as the `model` field.

## Setup

```bash
# .env
AZURE_OPENAI_API_KEY=...                                  # Azure key (api-key header)
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com # or https://<resource>.services.ai.azure.com
AZURE_OPENAI_DEPLOYMENT=o4-mini                           # your deployment name (= 'model' in body)
AZURE_OPENAI_API_VERSION=                                 # optional; empty = v1 route
```

The endpoint host is available under **Resource → "Keys and Endpoint"**. The
region is encoded in the host; there is no region path segment.

## EU data residency

Residency is a **deployment-time** choice, not something the provider enforces.
Create the resource in an EU region (**Germany West Central** or **Sweden Central**)
and choose the **`Data Zone Standard`** deployment type (in the portal:
*Region scope → Data Zone*). This keeps processing within the
[EU Data Boundary](https://learn.microsoft.com/en-us/privacy/eudb/eu-data-boundary-learn).

| Region scope (SKU) | Data processing | EU residency |
|---|---|---|
| `Global Standard` | any Azure region worldwide | ❌ no |
| **`Data Zone Standard`** | within the EU (or US) data zone | ✅ yes (EU) |
| `Standard` (regional) | single resource region only | ✅ strictest, fewest models |

> ⚠️ **Not all models offer Data Zone.** Most **partner/community models**
> (e.g. **Kimi K2.5**, many GLM/DeepSeek variants) are **`Global Standard` only**
> on Azure → they **cannot** be EU-resident. **`Data Zone Standard` is available
> for the Azure-OpenAI first-party models** (gpt-4o, gpt-4o-mini, o3-mini, o4-mini,
> gpt-5 series). The provider works with both; pick the residency per deployment.

## Reasoning vs. standard models (verified live)

Azure splits cleanly into two model classes that take **different parameters**.
The provider detects the class from the deployment name (overridable via
`reasoningModel`) and sends only the valid set:

| | Reasoning models (o-series, GPT-5) | Standard models (gpt-4o, …) |
|---|---|---|
| Token cap | `max_completion_tokens` | `max_tokens` |
| `temperature` / `top_p` | ❌ **rejected (HTTP 400)** → omitted | ✅ sent |
| `reasoning_effort` | ✅ `low` / `medium` / `high` | ignored (warning logged) |
| Reasoning tokens | `usage.completion_tokens_details.reasoning_tokens` → `usage.reasoningTokens` | — |

Verified against `o4-mini`: sending `temperature` **or** `max_tokens` returns
**HTTP 400**; `reasoning_effort` + `max_completion_tokens` succeed; a `system`
message is accepted (treated as a developer message).

## Usage

```typescript
import { llmService, LLMProvider } from '@loonylabs/llm-middleware';

// Reasoning model (o-series / GPT-5): reasoningEffort honored, temperature ignored
const reasoning = await llmService.callWithSystemMessage(
  'If a train travels 60 km in 45 minutes, what is its speed in km/h? Number only.',
  'You are a precise math tutor.',
  {
    provider: LLMProvider.AZURE_OPENAI,
    model: 'o4-mini',          // = deployment name; or process.env.AZURE_OPENAI_DEPLOYMENT
    maxTokens: 3000,           // → max_completion_tokens
    reasoningEffort: 'high'    // → reasoning_effort
  }
);
console.log(reasoning?.usage?.reasoningTokens);  // populated for reasoning models

// Standard model: temperature applies, reasoning_effort ignored
const standard = await llmService.callWithSystemMessage(
  'Write a haiku about coding.',
  'You are a creative poet.',
  {
    provider: LLMProvider.AZURE_OPENAI,
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1024
  }
);
```

### Per-request overrides

```typescript
{
  endpoint: 'https://<resource>.openai.azure.com', // overrides AZURE_OPENAI_ENDPOINT (also reads baseUrl)
  deployment: 'my-o4',                             // overrides model / AZURE_OPENAI_DEPLOYMENT
  apiVersion: '2024-05-01-preview',                // optional; appended as ?api-version=
  reasoningModel: true,                            // force reasoning-model handling for a renamed deployment
  authToken: process.env.AZURE_OPENAI_API_KEY      // overrides AZURE_OPENAI_API_KEY
}
```

## Request / response shape

```jsonc
// Request body (reasoning model)
{
  "model": "o4-mini",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "max_completion_tokens": 3000,
  "reasoning_effort": "high"
}

// Response body (OpenAI-compatible)
{
  "choices": [{ "message": { "role": "assistant", "content": "..." }, "finish_reason": "stop" }],
  "usage": {
    "prompt_tokens": 13, "completion_tokens": 84, "total_tokens": 97,
    "completion_tokens_details": { "reasoning_tokens": 64 },
    "prompt_tokens_details": { "cached_tokens": 0 }
  }
}
```

`reasoning_tokens` → `usage.reasoningTokens`; `cached_tokens` →
`usage.cacheMetadata.cacheReadTokens`. Azure hides raw reasoning text (only the
token count is returned), so `message.thinking` is normally empty for o-series;
partner models that inline `<think>` tags are still parsed by the ThinkingExtractor.

> **Debugging — "did reasoning run?"** Since the raw reasoning text is hidden, the
> debug log surfaces the **reasoning token count** instead. With `DEBUG_LLM_REQUESTS=true`
> (or `NODE_ENV=development`), the request log shows both the requested input and the
> returned output under *Provider Information*:
>
> ```
> - **Reasoning Effort**: high      # what was requested (input)
> - **Reasoning Tokens**: 64        # what came back (output) — proof reasoning ran
> ```

## Reasoning effort mapping

The provider exposes the model-agnostic `reasoningEffort` (`none|low|medium|high`,
same knob as Vertex AI / Bedrock):

- `low` / `medium` / `high` → forwarded verbatim as `reasoning_effort`.
- `none` → **omitted + warning**: only gpt-5.1+ accept `none`; o-series reject it,
  so the field is dropped and the model uses its default.

## Known limitations / planned follow-ups

- **Microsoft Entra ID auth** (Bearer/OAuth) is not yet implemented — API key only.
- **Partner/MaaS `/models/` route** is not yet implemented. Many partner models
  are reachable via the v1 route as a deployment; for those that require the
  Azure AI Inference `/models/chat/completions` route, support is a follow-up
  (the `apiVersion` option already lets you append `?api-version=`).
- **Raw reasoning text** is intentionally not exposed by Azure (token counts only).
- **`reasoningEffort: 'none'`** is not a reliable off-switch across model generations.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401` | Invalid Azure key, or key sent in the wrong header (must be `api-key`). |
| `404` | Deployment name not found, or `AZURE_OPENAI_ENDPOINT` not pointing at the resource host. |
| `400` on a reasoning model | `temperature`/`max_tokens` sent. Use `max_completion_tokens` and omit temperature (set `reasoningModel: true` if the deployment was renamed). |
| `429` | Rate limit / quota exceeded. The provider retries with backoff. |
| Only `Global` deployment offered | The model is a partner/community model (Global-only). For EU residency pick an Azure-OpenAI first-party model with `Data Zone Standard`. |

## Tests

- Unit (provider): `tests/unit/services/llm/providers/azure-openai-provider.test.ts`
- Unit (capabilities): `tests/unit/services/llm/providers/azure-openai-capabilities.test.ts`
- Smoke (live, needs `AZURE_OPENAI_*`): `npm run test:provider:azure`
  (Windows: `$env:TEST_PROVIDER='azure'; npx ts-node tests/manual/provider-smoke-test.ts`)
