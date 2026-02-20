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
│   └── requesty-provider.ts       # Requesty.AI implementation (v2.12+)
├── types/
│   ├── common.types.ts            # Provider-agnostic types
│   ├── ollama.types.ts            # Ollama-specific types
│   ├── anthropic.types.ts         # Anthropic-specific types (v2.1+)
│   ├── gemini.types.ts            # Gemini-specific types (v2.9+)
│   └── requesty.types.ts          # Requesty-specific types (v2.12+)
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

**Documentation:** See [OLLAMA_PARAMETERS.md](./OLLAMA_PARAMETERS.md)

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

- **EU Data Residency**: Regional endpoints (e.g., `europe-west3` for Frankfurt)
- **Service Account Auth**: OAuth2 Bearer Token from Google Cloud Service Account
- **Reasoning Control**: Full support for Gemini 2.5 (`thinkingBudget`) and Gemini 3 (`thinkingLevel`) with model-aware clamping (v2.24.0) — auto-fallback for unsupported levels on Pro models
- **Region Rotation** (v2.23.0): Automatic rotation through EU regions on quota errors (429) — uses provider-agnostic `RegionRotationConfig` and `isQuotaError()` utility
- **Preview Models**: Automatically routed to global endpoint

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
const serviceWithRotation = new LLMService({
  vertexAIConfig: {
    regionRotation: {
      regions: ['europe-west3', 'europe-west1', 'europe-west4', 'europe-north1'],
      fallback: 'global',
      alwaysTryFallback: true
    }
  }
});
```

**Region Rotation (v2.23.0):**

When Vertex AI returns a 429 quota error, the middleware automatically rotates through configured regions instead of retrying the same exhausted region.

- Retry budget is shared across all regions (not multiplied)
- Only quota errors (429, "Resource Exhausted") trigger rotation; server errors (500, 503) retry the same region
- After retry budget is exhausted, one bonus attempt on the fallback region
- Preview models (e.g., `gemini-3-flash-preview`) skip rotation — they always use global

**Configuration:**

```env
GOOGLE_CLOUD_PROJECT=your_project_id             # Google Cloud Project ID (required)
VERTEX_AI_REGION=europe-west3                     # Default region (Frankfurt)
VERTEX_AI_MODEL=gemini-2.5-flash                  # Default model
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json  # Service Account JSON path
```

**Credential Sources** (checked in order):
1. `serviceAccountKey` option (direct JSON object)
2. `serviceAccountKeyPath` option (file path)
3. `GOOGLE_APPLICATION_CREDENTIALS` env var (standard Google Cloud)
4. `VERTEX_AI_SERVICE_ACCOUNT_KEY` env var (JSON string)

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

# Minimal console output
DEBUG_LLM_MINIMAL=true

# Hide responses in console
DEBUG_LLM_RESPONSE_CONSOLE=false

# Backward compatibility (still works)
DEBUG_OLLAMA_REQUESTS=true
DEBUG_OLLAMA_MINIMAL=true
```

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
