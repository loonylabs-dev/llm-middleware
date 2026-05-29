# LLM Providers Guide

This guide explains the multi-provider architecture in `@loonylabs/llm-middleware` and how to work with different LLM providers.

## Overview

Starting with v2.0.0, `@loonylabs/llm-middleware` supports multiple LLM providers through a clean provider strategy pattern. This architecture allows you to:

- Use multiple LLM providers in the same application
- Switch between providers easily
- Maintain provider-specific optimizations
- Extend with new providers without breaking existing code

## Architecture

### Provider Strategy Pattern

```
src/middleware/services/llm/
├── providers/
│   ├── base-llm-provider.ts       # Abstract base class
│   ├── ollama-provider.ts         # Ollama implementation (v2.0+)
│   ├── anthropic-provider.ts      # Anthropic implementation (v2.1+)
│   ├── gemini-provider.ts         # Google Gemini implementation (v2.9+)
│   ├── requesty-provider.ts       # Requesty.AI implementation (v2.12+)
│   ├── bedrock-provider.ts        # AWS Bedrock implementation (v2.28+)
│   ├── azure-openai-provider.ts   # Azure OpenAI / Foundry implementation (v2.29+)
│   └── inceptron-provider.ts      # Inceptron implementation (v2.30+)
├── types/
│   ├── common.types.ts            # Provider-agnostic types
│   ├── ollama.types.ts            # Ollama-specific types
│   ├── anthropic.types.ts         # Anthropic-specific types (v2.1+)
│   ├── gemini.types.ts            # Gemini-specific types (v2.9+)
│   ├── requesty.types.ts          # Requesty-specific types (v2.12+)
│   ├── bedrock.types.ts           # Bedrock-specific types (v2.28+)
│   ├── azure-openai.types.ts      # Azure OpenAI-specific types (v2.29+)
│   └── inceptron.types.ts         # Inceptron-specific types (v2.30+)
└── llm.service.ts                 # Main orchestrator
```

### Key Components

1. **BaseLLMProvider**: Abstract class that all providers must extend
2. **Provider Implementations**: Concrete implementations for each LLM service
3. **LLMService**: Orchestrator that manages multiple providers
4. **Type System**: Common and provider-specific type definitions

## Currently Available Providers

### Ollama Provider (v2.0+)

Full-featured provider for Ollama with:
- Comprehensive parameter support
- Authentication retry strategies
- Session management
- Advanced debugging and logging

**Usage:**

```typescript
import { ollamaProvider } from '@loonylabs/llm-middleware';

const response = await ollamaProvider.callWithSystemMessage(
  "Write a haiku about coding",
  "You are a helpful assistant",
  {
    model: "llama2",
    temperature: 0.7,
    // Ollama-specific parameters
    repeat_penalty: 1.1,
    top_k: 40,
    num_predict: 100
  }
);
```

## Using the LLM Service Orchestrator

The `LLMService` provides a unified interface for all providers:

```typescript
import { llmService, LLMProvider } from '@loonylabs/llm-middleware';

// Use default provider (Ollama)
const response1 = await llmService.call(
  "Hello, world!",
  { model: "llama2" }
);

// Explicitly specify provider
const response2 = await llmService.call(
  "Hello, world!",
  {
    provider: LLMProvider.OLLAMA,
    model: "llama2"
  }
);

// Set default provider
llmService.setDefaultProvider(LLMProvider.OLLAMA);

// Get available providers
const providers = llmService.getAvailableProviders();
console.log('Available:', providers);
```

## Provider-Specific Features

### Ollama

**Supported Parameters:**
- `reasoningEffort` - Enable/disable native thinking for supported models (Qwen 3+, DeepSeek R1 etc.) — maps to Ollama's `think` flag internally. Only on/off supported; `low`/`medium`/`high` all enable thinking (warning logged for `low`/`medium`)
- `timeout` - Override default axios timeout in ms (default: 180000)
- `repeat_penalty` - Penalty for repeating tokens (default: 1.1)
- `top_p` - Top-p sampling (nucleus sampling)
- `top_k` - Top-k sampling
- `frequency_penalty` - Frequency penalty for token repetition
- `presence_penalty` - Presence penalty for new topics
- `repeat_last_n` - Number of previous tokens to consider
- `num_predict` - Maximum number of tokens to predict
- `mirostat`, `mirostat_eta`, `mirostat_tau` - Mirostat sampling
- `tfs_z` - Tail-free sampling
- `typical_p` - Typical sampling
- `num_thread` - Number of threads to use

**Documentation:** See [OLLAMA_PARAMETERS.md](./OLLAMA_PARAMETERS.md) and [REASONING_CONTROL.md](./REASONING_CONTROL.md)

### Anthropic Provider (v2.1+)

Full support for Anthropic Claude models with:
- All Claude 3.x models (Opus, Sonnet, Haiku)
- Claude 4.x models (Sonnet, Haiku)
- Extended context windows (up to 200K tokens)
- System prompts
- Lightweight axios-based implementation (no SDK dependency)

**Usage:**

```typescript
import { anthropicProvider, llmService, LLMProvider } from '@loonylabs/llm-middleware';

// Option 1: Use via LLM Service
const response1 = await llmService.call(
  "Explain quantum computing",
  {
    provider: LLMProvider.ANTHROPIC,
    model: "claude-3-5-sonnet-20241022",
    authToken: process.env.ANTHROPIC_API_KEY,
    maxTokens: 1024,
    temperature: 0.7
  }
);

// Option 2: Use provider directly
const response2 = await anthropicProvider.callWithSystemMessage(
  "Write a haiku about coding",
  "You are a creative poet",
  {
    model: "claude-3-5-sonnet-20241022",
    authToken: process.env.ANTHROPIC_API_KEY,
    maxTokens: 1024,
    temperature: 0.7,
    top_p: 0.9,
    top_k: 50
  }
);
```

**Supported Parameters:**
- `maxTokens` - Maximum tokens to generate (required, 1-4096)
- `temperature` - Randomness control (0-1, default: 0.7)
- `top_p` - Nucleus sampling (0-1)
- `top_k` - Top-k sampling
- `stop_sequences` - Custom stop sequences

**Configuration:**

```env
ANTHROPIC_API_KEY=sk-ant-api03-...your-key...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### Requesty.AI Provider (v2.12+)

Full support for Requesty.AI gateway providing access to 300+ models from multiple providers including EU-hosted OpenAI models:

- **EU-Hosted OpenAI**: DSGVO-compliant ChatGPT and GPT-4 models
- **Multi-Provider Access**: One API key for OpenAI, Anthropic, Google, and more
- **Cost Tracking**: Built-in cost in USD
- **Model Agnostic**: No model validation - use any available model
- **Enterprise Ready**: 180s timeout for stable gateway routing

**Usage:**

```typescript
import { requestyProvider, llmService, LLMProvider } from '@loonylabs/llm-middleware';

// Option 1: Use via LLM Service
const response1 = await llmService.call(
  "Explain quantum computing",
  {
    provider: LLMProvider.REQUESTY,
    model: "openai/gpt-4o",
    authToken: process.env.REQUESTY_API_KEY,
    maxTokens: 1024,
    temperature: 0.7
  }
);

// Option 2: Use provider directly
const response2 = await requestyProvider.callWithSystemMessage(
  "Write a haiku about coding",
  "You are a creative poet",
  {
    model: "anthropic/claude-3-5-sonnet",
    authToken: process.env.REQUESTY_API_KEY,
    maxTokens: 1024,
    temperature: 0.7
  }
);

// Access cost information
console.log(`Cost: ${response2.usage.cost in USD`);
```

**Supported Models** (Examples):

| Provider | Model Name Format | Example |
|----------|------------------|---------|
| OpenAI | `openai/model-name` | `openai/gpt-4o`, `openai/gpt-4-turbo` |
| Anthropic | `anthropic/model-name` | `anthropic/claude-3-5-sonnet` |
| Google | `google/model-name` | `google/gemini-pro` |
| Vertex AI | `vertex/model-name@region` | `vertex/gemini-2.5-flash-lite@europe-central2` |

*See [Requesty.AI documentation](https://docs.requesty.ai/) for full model list.*

**Supported Parameters:**

- `model` - Model identifier in format `provider/model-name` (required)
- `temperature` - Randomness control (0-1, default: 0.7)
- `maxTokens` - Maximum tokens to generate (default: 4096)
- `httpReferer` - Optional analytics header (your site URL)
- `xTitle` - Optional analytics header (your app name)

**Features:**

- ✅ **Cost Transparency**: Automatic cost in USD)
- ✅ **EU Data Residency**: Router endpoint `https://router.eu.requesty.ai/v1`
- ✅ **OpenAI-Compatible**: Standard `/v1/chat/completions` endpoint
- ✅ **Error Handling**: Comprehensive handling for 401, 429, 400 errors
- ✅ **Three-Level Logging**: Console, DataFlow, and file-based debug logs

**Configuration:**

```env
REQUESTY_API_KEY=your_requesty_api_key_here
REQUESTY_MODEL=openai/gpt-4o  # Default model (optional)
```

**Cost Tracking Example:**

```typescript
const response = await llmService.call(
  "Say hello in 3 words",
  {
    provider: LLMProvider.REQUESTY,
    model: "vertex/gemini-2.5-flash-lite@europe-central2"
  }
);

console.log(`Tokens: ${response.usage.totalTokens}`);
console.log(`Cost: ${response.usage.cost in USD`);
console.log(`Cost per 1000 calls: ${(response.usage.cost in USD`);

// Example output:
// Tokens: 12
// Cost: USD
// Cost per 1000 calls: 0.002400 USD
```

### Google Vertex AI Provider (v2.15+)

CDPA/GDPR-compliant provider with EU data residency for Google Gemini models. Uses OAuth2 Service Account authentication instead of API keys.

- **EU Data Residency**: Single regions (e.g., `europe-west3` for Frankfurt) **and** the `eu` multi-region (v2.29.2)
- **Multi-Region Endpoints** (v2.29.2): `eu` / `us` multi-regions via the `.rep.` hostname — required for the latest GA Flash models (`gemini-3.1-flash-lite`, `gemini-3.5-flash`), which single EU regions do not serve
- **Service Account Auth**: OAuth2 Bearer Token from Google Cloud Service Account
- **Reasoning Control**: Full support for Gemini 2.5 (`thinkingBudget`) and Gemini 3 (`thinkingLevel`) with model-aware clamping (v2.24.0) — auto-fallback for unsupported levels on Pro models
- **Region Rotation** (v2.23.0): Automatic rotation through EU regions on quota errors (429) — uses provider-agnostic `RegionRotationConfig` and `isQuotaError()` utility
- **Preview Models**: Automatically routed to global endpoint (not EU-resident)

**Usage:**

```typescript
import { LLMService, LLMProvider } from '@loonylabs/llm-middleware';

// Basic usage (no region rotation)
const service = new LLMService();
const response = await service.callWithSystemMessage(
  "Explain GDPR compliance",
  "You are a legal expert.",
  {
    provider: LLMProvider.VERTEX_AI,
    model: 'gemini-2.5-flash',
    reasoningEffort: 'medium'
  }
);

// With region rotation on quota errors (v2.23.0)
// ⚠️ For EU data residency: keep `fallback` an EU region — 'global' leaves the EU.
const serviceWithRotation = new LLMService({
  vertexAIConfig: {
    regionRotation: {
      regions: ['europe-west3', 'europe-west1', 'europe-west4', 'europe-north1'],
      fallback: 'europe-west4',   // EU fallback — NOT 'global' (that would leave the EU)
      alwaysTryFallback: false    // no bonus hop once EU regions are exhausted
    }
  }
});
```

**Region Rotation (v2.23.0):**

When Vertex AI returns a 429 quota error, the middleware automatically rotates through configured regions instead of retrying the same exhausted region.

- Retry budget is shared across all regions (not multiplied)
- Only quota errors (429, "Resource Exhausted") trigger rotation; server errors (500, 503) retry the same region
- After retry budget is exhausted, one bonus attempt on the fallback region (controlled by `alwaysTryFallback`)
- Preview models (e.g., `gemini-3-flash-preview`) skip rotation — they always use global

> **⚠️ Data residency warning:** `fallback: 'global'` — and any non-EU region inside `regions` — routes quota-exhausted requests **outside the EU** (no in-region ML processing). For EU data residency, use an **EU region** as `fallback` and set `alwaysTryFallback: false` to suppress the bonus hop. Note: the latest GA Flash models (`gemini-3.1-flash-lite`, `gemini-3.5-flash`) live **only** in the `eu` multi-region — there are no alternate single EU regions to rotate through, so rotation does not apply to them; use `region: 'eu'` with plain retry instead.

**Multi-Region Endpoints (v2.29.2):**

Newer GA models are served only via a multi-region location, not by single regions (live-verified):

| Model | Single EU regions (`europe-west3` …) | `eu` multi-region |
|---|---|---|
| `gemini-2.5-flash` | ✅ | ❌ |
| `gemini-3.1-flash-lite`, `gemini-3.5-flash` | ❌ (404) | ✅ |

Set `region: 'eu'` (or `VERTEX_AI_REGION=eu`) to reach the latest GA Flash models with EU data residency — the provider builds the dedicated multi-region host `https://aiplatform.eu.rep.googleapis.com` automatically. The `eu` multi-region keeps ML processing within the EU (Google's documented data-residency boundary); `global` does not. Preview models (`-preview`) always use `global` and are **not** EU-resident.

**Configuration:**

```env
GOOGLE_CLOUD_PROJECT=your_project_id             # Google Cloud Project ID (required)
VERTEX_AI_REGION=europe-west3                     # Single region (Frankfurt); use `eu` multi-region for gemini-3.x-flash GA models
VERTEX_AI_MODEL=gemini-2.5-flash                  # Default model
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json  # Service Account JSON path
```

**Credential Sources** (checked in order):
1. `serviceAccountKey` option (direct JSON object)
2. `serviceAccountKeyPath` option (file path)
3. `GOOGLE_APPLICATION_CREDENTIALS` env var (standard Google Cloud)
4. `VERTEX_AI_SERVICE_ACCOUNT_KEY` env var (JSON string)

### AWS Bedrock Provider (v2.28+)

Provider-agnostic access to AWS Bedrock foundation models (Claude, Nova, Llama,
Qwen, MiniMax, GLM, …) via the **Converse API**, authenticated with a **Bedrock
API key as a Bearer token** — no AWS SDK or SigV4 signing. Switching models is just
a different `model` id.

**Usage:**

```typescript
import { llmService, LLMProvider } from '@loonylabs/llm-middleware';

const response = await llmService.callWithSystemMessage(
  'Summarize the EU AI Act in two sentences.',
  'You are a precise assistant.',
  {
    provider: LLMProvider.BEDROCK,
    model: 'qwen.qwen3-32b-v1:0',  // or process.env.BEDROCK_MODEL
    temperature: 0.5,
    maxTokens: 1024
  }
);
```

**Environment variables:**

```bash
BEDROCK_API_KEY=ABSK...            # Bedrock API key (bearer token)
BEDROCK_REGION=eu-central-1        # Frankfurt = EU data residency (default)
BEDROCK_MODEL=qwen.qwen3-32b-v1:0  # default model id
```

**Key facts:**
- Endpoint: `https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/converse`
- Model availability is per region; some models need an `eu.`-prefixed cross-region
  inference profile id. List available models with `ListFoundationModels`.
- Native `reasoningContent` → `response.message.thinking`; cache tokens →
  `usage.cacheMetadata`.
- **Reasoning control** via the provider-agnostic `reasoningEffort` (low/med/high),
  mapped per model family (`reasoning_effort` for Qwen/Kimi/gpt-oss/GLM/DeepSeek,
  `reasoningConfig` for Nova). See AWS_BEDROCK.md → "Reasoning control".
- Not yet supported: Claude reasoning mapping, image input, region rotation.

See **[AWS_BEDROCK.md](AWS_BEDROCK.md)** for authentication strategies, region/model
availability, the Converse format, and troubleshooting.

### Azure OpenAI / Microsoft Foundry Provider (v2.29+)

Access to Azure OpenAI / Foundry models via the **OpenAI-compatible v1 route**,
authenticated with an **Azure API key in the `api-key` header** (not
`Authorization: Bearer`). The deployment name is sent as the `model` field, so the
payload matches a standard OpenAI request.

**Usage:**

```typescript
import { llmService, LLMProvider } from '@loonylabs/llm-middleware';

const response = await llmService.callWithSystemMessage(
  'If a train travels 60 km in 45 minutes, what is its speed in km/h? Number only.',
  'You are a precise math tutor.',
  {
    provider: LLMProvider.AZURE_OPENAI,
    model: 'o4-mini',          // = deployment name; or process.env.AZURE_OPENAI_DEPLOYMENT
    maxTokens: 3000,           // → max_completion_tokens for reasoning models
    reasoningEffort: 'high'    // → reasoning_effort
  }
);
console.log(response?.usage?.reasoningTokens);  // populated for reasoning models
```

**Environment variables:**

```bash
AZURE_OPENAI_API_KEY=...                                   # api-key header
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com  # resource host (region encoded here)
AZURE_OPENAI_DEPLOYMENT=o4-mini                            # deployment name (= 'model')
AZURE_OPENAI_API_VERSION=                                  # optional; empty = v1 route
```

**Key facts:**
- Endpoint: `{AZURE_OPENAI_ENDPOINT}/openai/v1/chat/completions` (api-version optional).
- **Reasoning vs. standard models take different params (verified live):** reasoning
  models (o-series, GPT-5) use `max_completion_tokens` and **reject** `temperature`/`max_tokens`
  (HTTP 400); standard models (gpt-4o…) use `max_tokens` + `temperature`. The provider
  detects the class by deployment name (override via `reasoningModel`).
- `reasoning_tokens` → `usage.reasoningTokens`; `cached_tokens` → `usage.cacheMetadata`.
- **EU data residency** is a deployment-time choice (`Data Zone Standard` in Germany West
  Central / Sweden Central). Partner models like Kimi K2.5 are **Global-only** (not EU-resident).
- Not yet supported: Entra ID auth, the partner `/models/` MaaS route.

See **[AZURE_OPENAI.md](AZURE_OPENAI.md)** for setup, residency, the reasoning/standard
split, request/response shape, and troubleshooting.

### Inceptron Provider (v2.30+)

Access to [Inceptron](https://www.inceptron.io/) (Inceptron AB, Lund/Sweden) — a
compiler-accelerated inference platform serving curated **open-weight models**
(GLM-5.1, Kimi, DeepSeek, gpt-oss, MiniMax, Llama) via the **OpenAI-compatible
Chat Completions API**, authenticated with a **Bearer token**. Modeled on the
Requesty provider.

**Usage:**

```typescript
import { llmService, LLMProvider } from '@loonylabs/llm-middleware';

const response = await llmService.callWithSystemMessage(
  'Summarize the CAP theorem in two sentences.',
  'You are a concise assistant.',
  {
    provider: LLMProvider.INCEPTRON,
    model: 'zai-org/GLM-5.1-FP8',   // exact id incl. quantization suffix; or process.env.INCEPTRON_MODEL
    reasoningEffort: 'medium'       // optional; default 'none'. Thinking text → response.message.thinking
  }
);
console.log(response?.message.thinking);  // reasoning channel (when reasoningEffort != 'none')
```

**Environment variables:**

```bash
INCEPTRON_API_KEY=...                                   # Bearer token (Authorization header)
INCEPTRON_BASE_URL=https://openrouter.inceptron.io/v1   # dashboard quickstart host (default)
INCEPTRON_MODEL=zai-org/GLM-5.1-FP8                     # default model id (EU-resident)
```

**Key facts (verified live against `zai-org/GLM-5.1-FP8`):**
- Endpoint: `{INCEPTRON_BASE_URL}/chat/completions`. The dashboard quickstart uses
  `openrouter.inceptron.io/v1` (not the `api.inceptron.io/v1` of the public docs).
- **Reasoning text returns in `message.reasoning`** (OpenRouter style) → mapped to
  `message.thinking`. `reasoning_effort` accepts `none`/`low`/`medium`/`high` (1:1).
- **`content` can be `null`.** Without an explicit `reasoning_effort` the visible
  answer is non-deterministic, so the provider **always sends one (default `none`)**.
- `usage` has **no** `reasoning_tokens`/`cost`; `cached_tokens` → `usage.cacheMetadata`.
- **EU data residency is per-model** (GLM-5.1 is EU-resident, ISO 27001). Default
  processing is not EU-only; zero-retention is on by default. **DPA & SCCs on request.**

See **[INCEPTRON.md](INCEPTRON.md)** for setup, residency/DPA details, the reasoning
behavior, token-usage caveats, and testing.

### OpenAI (Coming in v2.2)

Planned support for:
- GPT-4, GPT-3.5-turbo, etc.
- Streaming responses
- Function calling
- Vision capabilities

### Google Gemini Direct (Coming in v2.2)

Planned support for:
- Gemini models
- Multimodal inputs

## Adding a New Provider

To add a new provider, follow these steps:

### 1. Create Provider Types

Create a new file `src/middleware/services/llm/types/{provider}.types.ts`:

```typescript
import { CommonLLMOptions, CommonLLMResponse } from './common.types';

export interface CustomProviderOptions extends CommonLLMOptions {
  // Provider-specific options
  customParam1?: string;
  customParam2?: number;
}

export interface CustomProviderResponse extends CommonLLMResponse {
  // Provider-specific response fields
  customField?: string;
}
```

### 2. Implement Provider Class

Create `src/middleware/services/llm/providers/custom-provider.ts`:

```typescript
import { BaseLLMProvider } from './base-llm-provider';
import { LLMProvider, CommonLLMResponse } from '../types';
import { CustomProviderOptions } from '../types/custom.types';

export class CustomProvider extends BaseLLMProvider {
  constructor() {
    super(LLMProvider.CUSTOM); // Add CUSTOM to enum
  }

  async callWithSystemMessage(
    userPrompt: string,
    systemMessage: string,
    options: CustomProviderOptions = {}
  ): Promise<CommonLLMResponse | null> {
    // Implementation here
    // 1. Validate options
    // 2. Make API call
    // 3. Handle response
    // 4. Log with LLMDebugger
    // 5. Return normalized response
  }
}

export const customProvider = new CustomProvider();
```

### 3. Register Provider

Add to `src/middleware/services/llm/llm.service.ts`:

```typescript
constructor() {
  this.providers = new Map();
  this.providers.set(LLMProvider.OLLAMA, new OllamaProvider());
  this.providers.set(LLMProvider.CUSTOM, new CustomProvider()); // Add here
}
```

### 4. Export

Update `src/middleware/services/llm/providers/index.ts`:

```typescript
export * from './custom-provider';
```

### 5. Update Enum

Add to `src/middleware/services/llm/types/common.types.ts`:

```typescript
export enum LLMProvider {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  CUSTOM = 'custom' // Add here
}
```

## Debugging and Logging

All providers use the unified `LLMDebugger`:

```typescript
import { LLMDebugger, LLMDebugInfo } from '@loonylabs/llm-middleware';

// Logs are organized by provider
// logs/llm/ollama/requests/
// logs/llm/anthropic/requests/
// logs/llm/gemini/requests/
// logs/llm/requesty/requests/
```

### Environment Variables

```bash
# Enable debug logging for all providers
DEBUG_LLM_REQUESTS=true

# Minimal console output (suppresses prompt/response body, keeps headers)
DEBUG_LLM_MINIMAL=true

# Hide request block (🚀 LLM REQUEST) in console — file logs unaffected
DEBUG_LLM_REQUEST_CONSOLE=false

# Hide response block (📥 LLM RESPONSE) in console — file logs unaffected
DEBUG_LLM_RESPONSE_CONSOLE=false

# Suppress both request and response console output (errors still shown)
DEBUG_LLM_REQUEST_CONSOLE=false
DEBUG_LLM_RESPONSE_CONSOLE=false

# Backward compatibility aliases (still work)
DEBUG_OLLAMA_REQUESTS=true
DEBUG_OLLAMA_MINIMAL=true
DEBUG_OLLAMA_REQUEST_CONSOLE=false
DEBUG_OLLAMA_RESPONSE_CONSOLE=false
```

> **Note:** In development (`NODE_ENV=development`) the debugger is always enabled regardless of `DEBUG_LLM_REQUESTS`. Use `DEBUG_LLM_REQUEST_CONSOLE=false` / `DEBUG_LLM_RESPONSE_CONSOLE=false` to suppress console output while keeping file logs in `logs/llm/`.

## Type System

### Common Types (Provider-Agnostic)

```typescript
interface CommonLLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  authToken?: string;
  debugContext?: string;
  sessionId?: string;
  providerSpecific?: Record<string, any>;
}

interface CommonLLMResponse {
  message: { content: string };
  sessionId?: string;
  metadata?: {
    provider: string;
    model: string;
    tokensUsed?: number;
    processingTime?: number;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost in USD (provider-specific, e.g., Requesty)
  };
}
```

### Provider-Specific Types

Each provider extends the common types with their own parameters. See provider-specific documentation for details.

## Best Practices

1. **Use LLMService for flexibility**: Start with the `LLMService` orchestrator to easily switch providers
2. **Provider-specific code**: Use direct provider imports when you need provider-specific features
3. **Type safety**: Leverage TypeScript types for each provider
4. **Error handling**: All providers return `null` on error and log appropriately
5. **Testing**: Test with different providers to ensure portability

## Examples

### Multi-Provider Application

```typescript
import {
  llmService,
  LLMProvider,
  ollamaProvider
} from '@loonylabs/llm-middleware';

async function processWithBestProvider(prompt: string) {
  // Try Ollama first (local, fast)
  let response = await llmService.call(prompt, {
    provider: LLMProvider.OLLAMA,
    model: "llama2"
  });

  if (!response) {
    // Fallback to cloud provider
    console.log('Ollama failed, trying fallback...');
    // Future: OpenAI fallback
  }

  return response;
}
```

### Provider-Specific Optimization

```typescript
import { ollamaProvider } from '@loonylabs/llm-middleware';

// Use Ollama-specific parameters for fine-tuning
const response = await ollamaProvider.callWithSystemMessage(
  prompt,
  systemMessage,
  {
    model: "llama2",
    temperature: 0.7,
    // Ollama-specific optimizations
    repeat_penalty: 1.15,
    top_k: 40,
    mirostat: 2,
    mirostat_tau: 5.0
  }
);
```

## Migration from v1.x

If you're migrating from v1.x (ollama-middleware), see [CHANGELOG.md](../CHANGELOG.md) for the complete migration guide.

**TL;DR:**
- Update package name
- Imports still work (backward compatible)
- Optionally adopt new provider architecture

## Roadmap

### v2.12 (Released - 2025-12-08)
- ✅ Requesty.AI Provider (300+ models, EU-hosted OpenAI)
- ✅ Cost tracking in TokenUsage interface
- ✅ Global timeout increase (180s)
- ✅ Model agnostic gateway access

### v2.1-2.11 (Released)
- ✅ Anthropic Provider (Claude models)
- ✅ Google Gemini Provider
- ✅ Parametrized provider testing
- ✅ Provider-specific logging
- ✅ Dynamic system messages

### v2.13 (Planned)
- Streaming support across providers
- Enhanced cost analytics
- Provider health monitoring

### v2.3 (Planned)
- Provider health checking
- Automatic failover
- Response caching

### v3.0 (Future)
- Plugin system
- Custom provider registration
- Advanced routing strategies

## Contributing

Want to add a provider? See our [Contributing Guide](../CONTRIBUTING.md) and submit a PR!

## Support

- **Issues**: [GitHub Issues](https://github.com/loonylabs-dev/llm-middleware/issues)
- **Discussions**: [GitHub Discussions](https://github.com/loonylabs-dev/llm-middleware/discussions)
- **Documentation**: [README.md](../README.md)
