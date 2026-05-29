# AWS Bedrock Provider

The Bedrock provider integrates AWS Bedrock foundation models via the **Converse
API** using a **Bedrock API key as a Bearer token** — no AWS SDK and no SigV4
request signing required. It follows the same axios + Authorization-header pattern
as the Vertex AI provider.

- Provider id: `LLMProvider.BEDROCK` (`'bedrock'`)
- Endpoint: `https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/converse`
- Source: `src/middleware/services/llm/providers/bedrock-provider.ts`
- Types: `src/middleware/services/llm/types/bedrock.types.ts`

## Why Converse + Bearer token

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| API | **Converse** | InvokeModel | Converse is model-agnostic — one request/response shape across Claude, Nova, Llama, Qwen, MiniMax, GLM. InvokeModel needs a different payload per model family. |
| Auth | **Bearer token** | AWS SDK / SigV4 | The Bedrock API key works as a bearer token over plain REST. No heavy `@aws-sdk/*` dependency, no signing code. Mirrors the Vertex AI provider. |

## Authentication

AWS offers three ways to authenticate Bedrock calls. The "long-term key = testing
only" warning in the console refers specifically to **static API keys**, not to
production Bedrock usage in general.

| Method | Lifetime | AWS recommendation | Notes |
|---|---|---|---|
| **Short-term API key** | ≤ 12h (session) | ✅ also for production | Inherits the generating IAM principal's permissions. Expires — awkward for long-running servers unless refreshed. |
| **Long-term API key** | until expiry date | ⚠️ exploration only | Creates an IAM user with a broad `AmazonBedrockLimitedAccess` policy; no auto-rotation → higher leak risk. |
| **IAM role / temp credentials** | auto-rotating | ✅ production ideal | Only practical when running on AWS infra (EC2/Lambda/ECS). Requires the AWS SDK, not this provider's bearer flow. |

**Practical guidance for a self-hosted middleware (not on AWS infra):** a key with
a tightly scoped IAM policy (`bedrock:InvokeModel` — which also governs the Converse
API — on the specific model ARNs), stored securely in `.env` / a secret manager, is a reasonable
production setup — same risk profile as the existing `ANTHROPIC_API_KEY`. For
hardening, prefer short-term keys with automated refresh, or move onto AWS infra
and switch to IAM roles (which would require an SDK-based provider variant).

The bearer key also works against the **control-plane** endpoint
(`https://bedrock.{region}.amazonaws.com/foundation-models`) for `ListFoundationModels`,
which is handy for discovering available model ids (see below).

## Setup

```bash
# .env
BEDROCK_API_KEY=ABSK...               # Bedrock API key (bearer token)
BEDROCK_REGION=eu-north-1             # Stockholm (EU); has GLM-5, Kimi, DeepSeek, Qwen, gpt-oss
BEDROCK_MODEL=moonshotai.kimi-k2.5    # Kimi K2.5 (Intelligence Index 47 > Gemini 3 Flash 46)
```

The provider's built-in default region is `eu-central-1` (Frankfurt); set
`BEDROCK_REGION` explicitly for models only available in other EU regions.

## Region & model availability

Model availability is **per region**, and there are two access modes:

- **In-Region (On-Demand):** the model runs directly in the region → plain id, e.g.
  `qwen.qwen3-32b-v1:0`.
- **EU Cross-Region Inference Profile:** routes across several EU regions while
  staying within the EU → id prefixed with `eu.`, e.g. `eu.anthropic.claude-...`.

To list what is actually available **in your region**, call ListFoundationModels
with your bearer key (PowerShell example):

```powershell
$headers = @{ "Authorization" = "Bearer $env:BEDROCK_API_KEY" }
$resp = Invoke-RestMethod -Uri "https://bedrock.eu-central-1.amazonaws.com/foundation-models" -Headers $headers
$resp.modelSummaries | Select-Object -ExpandProperty modelId | Sort-Object
```

### Text models in eu-central-1 (Frankfurt), verified 2026-05-28 (selection)

- **Amazon Nova:** `amazon.nova-2-lite-v1:0`, `amazon.nova-lite-v1:0`, `amazon.nova-micro-v1:0`, `amazon.nova-pro-v1:0`
- **Anthropic Claude:** `anthropic.claude-3-haiku-20240307-v1:0`, `anthropic.claude-haiku-4-5-20251001-v1:0`, `anthropic.claude-sonnet-4-6`, `anthropic.claude-opus-4-8` (plus opus-4-5/4-6/4-7, sonnet-4/4-5)
- **Open-weight:** `qwen.qwen3-32b-v1:0`, `qwen.qwen3-235b-a22b-2507-v1:0`, `qwen.qwen3-coder-30b-a3b-v1:0`, `minimax.minimax-m2.1`, `minimax.minimax-m2.5`, `zai.glm-4.7-flash`, `openai.gpt-oss-120b-1:0`, `openai.gpt-oss-20b-1:0`
- **Meta / Mistral / NVIDIA:** `meta.llama3-2-1b-instruct-v1:0`, `meta.llama3-2-3b-instruct-v1:0`, `mistral.devstral-2-123b`, `mistral.pixtral-large-2502-v1:0`, `nvidia.nemotron-super-3-120b`

(Embedding/rerank/video models omitted.) Run the ListFoundationModels snippet above for the authoritative, current list.

Note: availability differs by EU region. **Frankfurt** (above) lacks the strongest
open-weight models. **Stockholm (`eu-north-1`)** and **London (`eu-west-2`)**
additionally offer `zai.glm-5`, `moonshotai.kimi-k2.5`, `deepseek.v3.2`. Quality
reference (Artificial Analysis Intelligence Index v4.0, vs. Gemini 3 Flash = 46):
GLM-5 = 50, Kimi K2.5 = 47 (both ≥ Flash3); MiniMax M2.5 / GLM-4.7 / DeepSeek V3.2 = 42.

## Usage

```typescript
import { llmService, LLMProvider } from '@loonylabs/llm-middleware';

const response = await llmService.callWithSystemMessage(
  'Summarize the EU AI Act in two sentences.',
  'You are a precise assistant.',
  {
    provider: LLMProvider.BEDROCK,
    model: 'qwen.qwen3-32b-v1:0',   // or process.env.BEDROCK_MODEL
    temperature: 0.5,
    maxTokens: 1024,
    // region: 'eu-central-1',       // optional, defaults to BEDROCK_REGION
    // authToken: process.env.BEDROCK_API_KEY  // optional, read from env by default
  }
);

console.log(response?.message.content);
console.log(response?.usage);  // { inputTokens, outputTokens, totalTokens, ... }
```

## Converse request/response shape

```jsonc
// Request body
{
  "messages": [{ "role": "user", "content": [{ "text": "..." }] }],
  "system": [{ "text": "..." }],                 // top-level array, optional
  "inferenceConfig": { "maxTokens": 1024, "temperature": 0.5, "topP": 0.9 }
}

// Response body
{
  "output": { "message": { "role": "assistant", "content": [{ "text": "..." }] } },
  "stopReason": "end_turn",
  "usage": { "inputTokens": 49, "outputTokens": 10, "totalTokens": 59 }
}
```

Reasoning-capable models may add a `reasoningContent` block
(`content[].reasoningContent.reasoningText.text`); the provider maps it to
`response.message.thinking`.

## Reasoning control

The provider exposes a single, model-agnostic knob: `reasoningEffort`
(`none` | `low` | `medium` | `high`) — the same parameter used by the Vertex AI
provider. A per-family strategy (`providers/bedrock-reasoning/`) translates it to
the mechanism the chosen model actually understands; native reasoning returned by
the model is extracted into `response.message.thinking`.

| Model family | Mechanism (Converse `additionalModelRequestFields`) | Granularity | Verified |
|---|---|---|---|
| Qwen, Kimi, gpt-oss, GLM (5/4.7), DeepSeek | `reasoning_effort` | low/med/high | ✅ |
| Amazon Nova 2 | `reasoningConfig` { type, maxReasoningEffort } | low/med/high | ✅ |
| MiniMax | — (always-on interleaved thinking) | none (no-op) | ✅ |
| Anthropic Claude | `thinking` budget tokens — *not yet mapped* (no-op) | — | follow-up |

```typescript
const res = await llmService.callWithSystemMessage(prompt, system, {
  provider: LLMProvider.BEDROCK,
  model: 'moonshotai.kimi-k2.5',
  reasoningEffort: 'high'   // → reasoning_effort: 'high' for Kimi
});
console.log(res?.message.thinking);  // populated when the model returns reasoningContent
```

Notes:
- `reasoning_effort` is the **default** strategy (any model not matched above), since
  every open-weight model verified on Bedrock honors it — keeps behavior uniform.
- `reasoningEffort: 'none'` is **not a reliable off-switch** for `reasoning_effort`
  models (they reason by default, no Converse toggle); the field is omitted + warned.
- **Nova at `high`** forbids `temperature`/`topP`/`maxTokens`; the provider removes
  them automatically and logs a warning (reasoning wins, per design).
- Separate `reasoningContent` (→ `message.thinking`) appears mainly at higher effort
  / harder prompts; on trivial prompts a model may inline its reasoning into the answer.

## Known limitations / planned follow-ups

- **Claude reasoning is not yet mapped.** Claude on Bedrock uses a `thinking` token
  budget instead of `reasoning_effort`; Claude models are currently a no-op for
  `reasoningEffort` (warning logged). All other families are mapped (see above).
- **Kimi/Moonshot on Converse:** there are reported Converse bugs for Kimi around
  **tool use** (premature `end_turn`, token leaking). Plain text generation worked
  reliably in testing; avoid relying on Kimi tool calls via Converse for now.
- **Image / vision input is not supported yet.** Only text parts are sent; a
  warn-log is emitted if images are present. Converse image blocks
  (`content[].image.{format, source.bytes}`) are a planned follow-up.
- **No `reasoningTokens` tracking.** Converse `usage` does not separate reasoning
  tokens; they are included in `outputTokens`.
- **No region rotation.** Unlike Vertex AI, the Bedrock provider does not yet rotate
  regions on quota errors.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401` | Invalid or expired Bedrock API key. |
| `403` | Model access not granted, or the model is not available in this region. Check "Model access" / "Model catalog" in the Bedrock console for the region, or use a model from the list above. |
| `429` | Rate limit / quota exceeded. The provider retries with backoff. |
| `ValidationException` (400) | Often a model that requires an inference profile (`eu.`-prefixed id) instead of the plain id, or an unsupported parameter. |

## Tests

- Unit (provider): `tests/unit/services/llm/providers/bedrock-provider.test.ts`
- Unit (reasoning strategies + factory): `tests/unit/services/llm/providers/bedrock-reasoning.test.ts`
- Smoke (live, needs `BEDROCK_API_KEY`): `npm run test:provider:bedrock`
  (Windows: `$env:TEST_PROVIDER='bedrock'; npx ts-node tests/manual/provider-smoke-test.ts`)
