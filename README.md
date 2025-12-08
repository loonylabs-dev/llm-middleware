<div align="center">

# 🚀 LLM Middleware

*A comprehensive TypeScript middleware library for building robust multi-provider LLM backends. Currently supports Ollama, Anthropic Claude, Google Gemini, and Requesty.AI (300+ models, EU-hosted OpenAI). Features advanced JSON cleaning, logging, error handling, cost tracking, and more.*

<!-- Horizontal Badge Navigation Bar -->
[![npm version](https://img.shields.io/npm/v/@loonylabs/llm-middleware.svg?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/@loonylabs/llm-middleware)
[![npm downloads](https://img.shields.io/npm/dm/@loonylabs/llm-middleware.svg?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/@loonylabs/llm-middleware)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg?style=for-the-badge&logo=typescript&logoColor=white)](#-features)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](#-prerequisites)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge&logo=opensource&logoColor=white)](#-license)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/loonylabs-dev/llm-middleware)

</div>

<!-- Table of Contents -->
<details>
<summary>📋 <strong>Table of Contents</strong></summary>

- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [📋 Prerequisites](#-prerequisites)
- [⚙️ Configuration](#️-configuration)
- [🏗️ Architecture](#️-architecture)
- [📖 Documentation](#-documentation)
- [🧪 Testing and Examples](#-testing-and-examples)
- [🔧 Advanced Features](#-advanced-features)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)
- [🔗 Links](#-links)

</details>

---

## ✨ Features

- 🏗️ **Clean Architecture**: Base classes and interfaces for scalable AI applications
  - ✨ **v2.11.0**: Dynamic system messages via `getSystemMessage(request)` override
- 🤖 **Multi-Provider Architecture**: Extensible provider system with strategy pattern
  - ✅ **Ollama**: Fully supported with comprehensive parameter control
  - ✅ **Anthropic Claude**: Complete support for Claude models (Opus, Sonnet, Haiku)
  - ✅ **Google Gemini**: Complete support for Gemini models (Pro, Flash)
  - ✅ **Requesty.AI**: 300+ models via unified API, EU-hosted OpenAI (DSGVO-compliant), built-in cost tracking
  - 🔌 **Pluggable**: Easy to add custom providers - see [LLM Providers Guide](docs/LLM_PROVIDERS.md)
- 🧹 **JSON Cleaning**: Recipe-based JSON repair system with automatic strategy selection
  - ✨ **v2.4.0**: Enhanced array extraction support - properly handles JSON arrays `[...]` in addition to objects `{...}`
- 🎨 **FlatFormatter System**: Advanced data formatting for LLM consumption
- 📊 **Comprehensive Logging**: Multi-level logging with metadata support
- ⚙️ **Configuration Management**: Flexible model and application configuration
- 🛡️ **Error Handling**: Robust error handling and recovery mechanisms
- 🔧 **TypeScript First**: Full type safety throughout the entire stack
- 📦 **Modular Design**: Use only what you need
- 🧪 **Testing Ready**: Includes example implementations and test utilities

## 🚀 Quick Start

### Installation

Install from npm:

```bash
npm install @loonylabs/llm-middleware
```

Or install directly from GitHub:

```bash
npm install github:loonylabs-dev/llm-middleware
```

Or using a specific version/tag:

```bash
npm install github:loonylabs-dev/llm-middleware#v1.3.0
```

### Basic Usage

```typescript
import { BaseAIUseCase, BaseAIRequest, BaseAIResult, LLMProvider } from '@loonylabs/llm-middleware';

// Define your request/response interfaces
interface MyRequest extends BaseAIRequest<string> {
  message: string;
}

interface MyResult extends BaseAIResult {
  response: string;
}

// Create your use case (uses Ollama by default)
class MyChatUseCase extends BaseAIUseCase<string, MyRequest, MyResult> {
  protected readonly systemMessage = "You are a helpful assistant.";

  // Required: return user message template function
  protected getUserTemplate(): (formattedPrompt: string) => string {
    return (message) => message;
  }

  protected formatUserMessage(prompt: any): string {
    return typeof prompt === 'string' ? prompt : prompt.message;
  }

  protected createResult(content: string, usedPrompt: string, thinking?: string): MyResult {
    return {
      generatedContent: content,
      model: this.modelConfig.name,
      usedPrompt: usedPrompt,
      thinking: thinking,
      response: content
    };
  }
}

// Switch to different provider (optional)
class MyAnthropicChatUseCase extends MyChatUseCase {
  protected getProvider(): LLMProvider {
    return LLMProvider.ANTHROPIC;  // Use Claude instead of Ollama
  }
}

// Dynamic system message based on request data (v2.11.0+)
class DynamicSystemMessageUseCase extends BaseAIUseCase<MyPrompt, MyRequest, MyResult> {
  protected readonly systemMessage = "Default system message";

  // Override to customize system message per-request
  protected getSystemMessage(request?: MyRequest): string {
    const context = request?.prompt?.context;
    if (context === 'technical') {
      return "You are a technical expert. Be precise and detailed.";
    }
    return this.systemMessage;
  }
  // ... other methods
}
```

<details>
<summary><strong>🔌 Using the Multi-Provider Architecture</strong></summary>

```typescript
import { llmService, LLMProvider, ollamaProvider, anthropicProvider, geminiProvider } from '@loonylabs/llm-middleware';

// Option 1: Use the LLM Service orchestrator (recommended for flexibility)
const response1 = await llmService.call(
  "Write a haiku about coding",
  {
    provider: LLMProvider.OLLAMA,  // Explicitly specify provider
    model: "llama2",
    temperature: 0.7
  }
);

// Use Anthropic Claude
const response2 = await llmService.call(
  "Explain quantum computing",
  {
    provider: LLMProvider.ANTHROPIC,
    model: "claude-3-5-sonnet-20241022",
    authToken: process.env.ANTHROPIC_API_KEY,
    maxTokens: 1024,
    temperature: 0.7
  }
);

// Use Google Gemini
const response3 = await llmService.call(
  "What is machine learning?",
  {
    provider: LLMProvider.GOOGLE,
    model: "gemini-1.5-pro",
    authToken: process.env.GEMINI_API_KEY,
    maxTokens: 1024,
    temperature: 0.7
  }
);

// Option 2: Use provider directly for provider-specific features
const response4 = await ollamaProvider.callWithSystemMessage(
  "Write a haiku about coding",
  "You are a creative poet",
  {
    model: "llama2",
    temperature: 0.7,
    // Ollama-specific parameters
    repeat_penalty: 1.1,
    top_k: 40
  }
);

// Or use Anthropic provider directly
const response5 = await anthropicProvider.call(
  "Write a haiku about coding",
  {
    model: "claude-3-5-sonnet-20241022",
    authToken: process.env.ANTHROPIC_API_KEY,
    maxTokens: 1024
  }
);

// Or use Gemini provider directly
const response6 = await geminiProvider.call(
  "Write a haiku about coding",
  {
    model: "gemini-1.5-pro",
    authToken: process.env.GEMINI_API_KEY,
    maxOutputTokens: 1024
  }
);

// Set default provider for your application
llmService.setDefaultProvider(LLMProvider.OLLAMA);

// Now calls use Ollama by default
const response7 = await llmService.call("Hello!", { model: "llama2" });
```

For more details on the multi-provider system, see the [LLM Providers Guide](docs/LLM_PROVIDERS.md).

</details>

<details>
<summary><strong>🎭 Advanced Example with FlatFormatter</strong></summary>

```typescript
import { 
  FlatFormatter, 
  personPreset
} from '@loonylabs/llm-middleware';

class ProfileGeneratorUseCase extends BaseAIUseCase {
  protected readonly systemMessage = `You are a professional profile creator.
  
IMPORTANT: Respond with ONLY valid JSON following this schema:
{
  "name": "Person name",
  "title": "Professional title", 
  "summary": "Brief professional overview",
  "skills": "Key skills and expertise",
  "achievements": "Notable accomplishments"
}`;

  // Use FlatFormatter and presets for rich context building
  protected formatUserMessage(prompt: any): string {
    const { person, preferences, guidelines } = prompt;
    
    const contextSections = [
      // Use preset for structured data
      personPreset.formatForLLM(person, "## PERSON INFO:"),
      
      // Use FlatFormatter for custom structures
      `## PREFERENCES:\n${FlatFormatter.flatten(preferences, {
        format: 'bulleted',
        keyValueSeparator: ': '
      })}`,
      
      // Format guidelines with FlatFormatter
      `## GUIDELINES:\n${FlatFormatter.flatten(
        guidelines.map(g => ({ 
          guideline: g,
          priority: "MUST FOLLOW" 
        })),
        {
          format: 'numbered',
          entryTitleKey: 'guideline',
          ignoredKeys: ['guideline']
        }
      )}`
    ];
    
    return contextSections.join('\n\n');
  }
  
  protected createResult(content: string, usedPrompt: string, thinking?: string): MyResult {
    return {
      generatedContent: content,
      model: this.modelConfig.name,
      usedPrompt,
      thinking,
      profile: JSON.parse(content)
    };
  }
}

// Use it
const profileGen = new ProfileGeneratorUseCase();
const result = await profileGen.execute({ 
  prompt: { 
    person: { name: "Alice", occupation: "Engineer" },
    preferences: { tone: "professional", length: "concise" },
    guidelines: ["Highlight technical skills", "Include leadership"]
  },
  authToken: "optional-token"
});
```

</details>

## 📋 Prerequisites

<details>
<summary><strong>📦 Required Dependencies</strong></summary>

- **Node.js** 18+
- **TypeScript** 4.9+
- **LLM Provider** configured (e.g., Ollama server for Ollama provider)

</details>

## ⚙️ Configuration

<details>
<summary><strong>🔧 Environment Setup</strong></summary>

Create a `.env` file in your project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info

# LLM Provider Configuration
MODEL1_NAME=phi3:mini              # Required: Your model name
MODEL1_URL=http://localhost:11434  # Optional: Defaults to localhost (Ollama)
MODEL1_TOKEN=optional-auth-token   # Optional: For authenticated providers

# Anthropic API Configuration (Optional)
ANTHROPIC_API_KEY=your_anthropic_api_key_here    # Your Anthropic API key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022       # Default Claude model

# Google Gemini API Configuration (Optional)
GEMINI_API_KEY=your_gemini_api_key_here          # Your Google Gemini API key
GEMINI_MODEL=gemini-1.5-pro                      # Default Gemini model
```

**Multi-Provider Support:** The middleware is fully integrated with **Ollama**, **Anthropic Claude**, and **Google Gemini**. Support for OpenAI is planned. See the [LLM Providers Guide](docs/LLM_PROVIDERS.md) for details on the provider system and how to use or add providers.

</details>

## 🏗️ Architecture

The middleware follows **Clean Architecture** principles:

```
src/
├── middleware/
│   ├── controllers/base/     # Base HTTP controllers
│   ├── usecases/base/        # Base AI use cases
│   ├── services/             # External service integrations
│   │   ├── llm/             # LLM provider services (Ollama, OpenAI, etc.)
│   │   ├── json-cleaner/    # JSON repair and validation
│   │   └── response-processor/ # AI response processing
│   └── shared/              # Common utilities and types
│       ├── config/          # Configuration management
│       ├── types/           # TypeScript interfaces
│       └── utils/           # Utility functions
└── examples/               # Example implementations
    └── simple-chat/        # Basic chat example
```

## 📖 Documentation

- [Getting Started Guide](docs/GETTING_STARTED.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [LLM Providers Guide](docs/LLM_PROVIDERS.md) - Multi-provider architecture and how to use different LLM services
- [LLM Provider Parameters](docs/OLLAMA_PARAMETERS.md) - Ollama-specific parameter reference and presets
- [Request Formatting Guide](docs/REQUEST_FORMATTING.md) - FlatFormatter vs RequestFormatterService
- [Performance Monitoring](docs/PERFORMANCE_MONITORING.md) - Metrics and logging
- [API Reference](docs/API_REFERENCE.md)
- [Examples](docs/EXAMPLES.md)
- [CHANGELOG](CHANGELOG.md) - Release notes and breaking changes

## 🧪 Testing

The middleware includes comprehensive test suites covering unit tests, integration tests, robustness tests, and end-to-end workflows.

### Quick Start

```bash
# Build the middleware first
npm run build

# Run all automated tests
npm run test:all

# Run unit tests only
npm run test:unit
```

**📖 For complete testing documentation**, see **[tests/README.md](tests/README.md)**

The test documentation includes:
- 📋 Quick reference table for all tests
- 🚀 Detailed test descriptions and prerequisites
- ⚠️ Troubleshooting guide
- 🔬 Development workflow best practices

### 🐦 Tweet Generator Example

<details>
<summary><strong>💬 Demonstrating Token Limiting with Social Media Content</strong></summary>

The **Tweet Generator** example showcases parameter configuration for controlling output length:

```typescript
import { TweetGeneratorUseCase } from '@loonylabs/llm-middleware';

const tweetGenerator = new TweetGeneratorUseCase();

const result = await tweetGenerator.execute({
  prompt: 'The importance of clean code in software development'
});

console.log(result.tweet);          // Generated tweet
console.log(result.characterCount); // Character count
console.log(result.withinLimit);    // true if ≤ 280 chars
```

**Key Features:**
- 🎯 **Token Limiting**: Uses `maxTokens: 70` to limit output to ~280 characters (provider-agnostic!)
- 📊 **Character Validation**: Automatically checks if output is within Twitter's limit
- 🎨 **Marketing Preset**: Optimized parameters for engaging, concise content
- ✅ **Testable**: Integration test verifies parameter effectiveness

**Parameter Configuration:**
```typescript
protected getParameterOverrides(): ModelParameterOverrides {
  return {
    // ✅ NEW in v2.7.0: Provider-agnostic maxTokens (recommended)
    maxTokens: 70,          // Works for Anthropic, OpenAI, Ollama, Google

    // Parameter tuning
    temperatureOverride: 0.7,
    repeatPenalty: 1.3,
    frequencyPenalty: 0.3,
    presencePenalty: 0.2,
    topP: 0.9,
    topK: 50,
    repeatLastN: 32
  };
}

// 💡 Legacy Ollama-specific approach (still works):
protected getParameterOverrides(): ModelParameterOverrides {
  return {
    num_predict: 70,        // Ollama-specific (deprecated)
    // ... other params
  };
}
```

This example demonstrates:
- How to configure parameters for specific output requirements
- Token limiting as a practical use case
- Validation and testing of parameter effectiveness
- Real-world application (social media content generation)

See `src/examples/tweet-generator/` for full implementation.

</details>

### 🎯 Example Application

<details>
<summary><strong>🚀 Quick Example Setup</strong></summary>

Run the included examples:

```bash
# Clone the repository
git clone https://github.com/loonylabs-dev/llm-middleware.git
cd llm-middleware

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start your LLM provider (example for Ollama)
ollama serve

# Run the example
npm run dev
```

Test the API:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

</details>

## 🔧 Advanced Features

<details>
<summary><strong>🧹 Recipe-Based JSON Cleaning System</strong></summary>

Advanced JSON repair with automatic strategy selection and modular operations:

```typescript
import { JsonCleanerService, JsonCleanerFactory } from '@loonylabs/llm-middleware';

// Simple usage (async - uses new recipe system with fallback)
const result = await JsonCleanerService.processResponseAsync(malformedJson);
console.log(result.cleanedJson);

// Legacy sync method (still works)
const cleaned = JsonCleanerService.processResponse(malformedJson);

// Advanced: Quick clean with automatic recipe selection
const result = await JsonCleanerFactory.quickClean(malformedJson);
console.log('Success:', result.success);
console.log('Confidence:', result.confidence);
console.log('Changes:', result.totalChanges);
```

**Features:**
- 🎯 Automatic strategy selection (Conservative/Aggressive/Adaptive)
- 🔧 Modular detectors & fixers for specific problems
- ✨ Extracts JSON from Markdown/Think-Tags
- 🔄 Checkpoint/Rollback support for safe repairs
- 📊 Detailed metrics (confidence, quality, performance)
- 🛡️ Fallback to legacy system for compatibility

**Available Templates:**
```typescript
import { RecipeTemplates } from '@loonylabs/llm-middleware';

const conservativeRecipe = RecipeTemplates.conservative();
const aggressiveRecipe = RecipeTemplates.aggressive();
const adaptiveRecipe = RecipeTemplates.adaptive();
```

See [Recipe System Documentation](src/middleware/services/json-cleaner/recipe-system/README.md) for details.

</details>

<details>
<summary><strong>📝 Request Formatting (FlatFormatter & RequestFormatterService)</strong></summary>

**For simple data:** Use [FlatFormatter](src/middleware/services/flat-formatter/README.md)
```typescript
const flat = FlatFormatter.flatten({ name: 'Alice', age: 30 });
```

**For complex nested prompts:** Use RequestFormatterService
```typescript
import { RequestFormatterService } from '@loonylabs/llm-middleware';

const prompt = {
  context: { genre: 'sci-fi', tone: 'dark' },
  instruction: 'Write an opening'
};

const formatted = RequestFormatterService.formatUserMessage(
  prompt, (s) => s, 'MyUseCase'
);
// Outputs: ## CONTEXT:\ngenre: sci-fi\ntone: dark\n\n## INSTRUCTION:\nWrite an opening
```

See [Request Formatting Guide](docs/REQUEST_FORMATTING.md) for details.

</details>

<details>
<summary><strong>📊 Performance Monitoring & Metrics</strong></summary>

Automatic performance tracking with `UseCaseMetricsLoggerService`:

```typescript
// Automatically logged for all use cases:
// - Execution time
// - Token usage (input/output)
// - Generation speed (tokens/sec)
// - Parameters used
```

Metrics appear in console logs:
```
✅ Completed AI use case [MyUseCase = phi3:mini] SUCCESS
   Time: 2.5s | Input: 120 tokens | Output: 85 tokens | Speed: 34.0 tokens/sec
```

See [Performance Monitoring Guide](docs/PERFORMANCE_MONITORING.md) for advanced usage.

</details>

<details>
<summary><strong>📊 Comprehensive Logging</strong></summary>

Multi-level logging with contextual metadata:

```typescript
import { logger } from '@loonylabs/llm-middleware';

logger.info('Operation completed', {
  context: 'MyService',
  metadata: { userId: 123, duration: 150 }
});
```

</details>

<details>
<summary><strong>⚙️ Model Configuration</strong></summary>

Flexible model management:

```typescript
import { getModelConfig } from '@loonylabs/llm-middleware';

// MODEL1_NAME is required in .env or will throw error
const config = getModelConfig('MODEL1');
console.log(config.name);     // Value from MODEL1_NAME env variable
console.log(config.baseUrl);  // Value from MODEL1_URL or default localhost
```

</details>

<details>
<summary><strong>🔧 Customizing Model Configuration (New in v2.3.0)</strong></summary>

Override the model configuration provider to use your own custom model configurations:

**Use Cases:**
- Multi-environment deployments (dev, staging, production)
- Dynamic model selection based on runtime conditions
- Loading model configs from external sources (database, API)
- Testing with different model configurations

**New Pattern (Recommended):**

```typescript
import { BaseAIUseCase, ModelConfigKey, ValidatedLLMModelConfig } from '@loonylabs/llm-middleware';

// Define your custom model configurations
const MY_CUSTOM_MODELS: Record<string, ValidatedLLMModelConfig> = {
  'PRODUCTION_MODEL': {
    name: 'llama3.2:latest',
    baseUrl: 'http://production-server.com:11434',
    temperature: 0.7
  },
  'DEVELOPMENT_MODEL': {
    name: 'llama3.2:latest',
    baseUrl: 'http://localhost:11434',
    temperature: 0.9
  }
};

class MyCustomUseCase extends BaseAIUseCase<string, MyRequest, MyResult> {
  // Override this method to provide custom model configurations
  protected getModelConfigProvider(key: ModelConfigKey): ValidatedLLMModelConfig {
    const config = MY_CUSTOM_MODELS[key];
    if (!config?.name) {
      throw new Error(`Model ${key} not found`);
    }
    return config;
  }

  // ... rest of your use case implementation
}
```

**Environment-Aware Example:**

```typescript
class EnvironmentAwareUseCase extends BaseAIUseCase<string, MyRequest, MyResult> {
  protected getModelConfigProvider(key: ModelConfigKey): ValidatedLLMModelConfig {
    const env = process.env.NODE_ENV || 'development';

    // Automatically select model based on environment
    const modelKey = env === 'production' ? 'PRODUCTION_MODEL' :
                     env === 'staging' ? 'STAGING_MODEL' :
                     'DEVELOPMENT_MODEL';

    return MY_CUSTOM_MODELS[modelKey];
  }
}
```

**Old Pattern (Still Supported):**

```typescript
// Legacy approach - still works but not recommended
class LegacyUseCase extends BaseAIUseCase<string, MyRequest, MyResult> {
  protected get modelConfig(): ValidatedLLMModelConfig {
    return myCustomGetModelConfig(this.modelConfigKey);
  }
}
```

**See the [Custom Config Example](src/examples/custom-config/README.md) for a complete working implementation.**

</details>

<details>
<summary><strong>🎛️ Parameter Configuration</strong></summary>

LLM-middleware provides fine-grained control over model parameters to optimize output for different use cases:

```typescript
import { BaseAIUseCase, ModelParameterOverrides } from '@loonylabs/llm-middleware';

class MyUseCase extends BaseAIUseCase<MyRequest, MyResult> {
  protected getParameterOverrides(): ModelParameterOverrides {
    return {
      temperatureOverride: 0.8,      // Control creativity vs. determinism
      repeatPenalty: 1.3,             // Reduce word repetition
      frequencyPenalty: 0.2,          // Penalize frequent words
      presencePenalty: 0.2,           // Encourage topic diversity
      topP: 0.92,                     // Nucleus sampling threshold
      topK: 60,                       // Vocabulary selection limit
      repeatLastN: 128                // Context window for repetition
    };
  }
}
```

**Parameter Levels:**
- **Global defaults**: Set in `ModelParameterManagerService`
- **Use-case level**: Override via `getParameterOverrides()` method
- **Request level**: Pass parameters directly in requests

**Available Presets:**

```typescript
import { ModelParameterManagerService } from '@loonylabs/llm-middleware';

// Use curated presets for common use cases
const creativeParams = ModelParameterManagerService.getDefaultParametersForType('creative_writing');
const factualParams = ModelParameterManagerService.getDefaultParametersForType('factual');
const poeticParams = ModelParameterManagerService.getDefaultParametersForType('poetic');
const dialogueParams = ModelParameterManagerService.getDefaultParametersForType('dialogue');
const technicalParams = ModelParameterManagerService.getDefaultParametersForType('technical');
const marketingParams = ModelParameterManagerService.getDefaultParametersForType('marketing');
```

**Presets Include:**
- 📚 **Creative Writing**: Novels, stories, narrative fiction
- 📊 **Factual**: Reports, documentation, journalism
- 🎭 **Poetic**: Poetry, lyrics, artistic expression
- 💬 **Dialogue**: Character dialogue, conversational content
- 🔧 **Technical**: Code documentation, API references
- 📢 **Marketing**: Advertisements, promotional content

For detailed documentation about all parameters, value ranges, and preset configurations, see:
**[Provider Parameters Guide](./docs/OLLAMA_PARAMETERS.md)** (Ollama-specific)

</details>

---

### 🔧 Response Processing Options (v2.8.0)

<details>
<summary><strong>📦 Configurable Response Processing</strong></summary>

Starting in v2.8.0, you can customize how responses are processed with `ResponseProcessingOptions`:

#### Available Options

```typescript
interface ResponseProcessingOptions {
  extractThinkTags?: boolean;    // default: true
  extractMarkdown?: boolean;     // default: true
  validateJson?: boolean;        // default: true
  cleanJson?: boolean;           // default: true
  recipeMode?: 'conservative' | 'aggressive' | 'adaptive';
}
```

#### Usage in Use Cases

Override `getResponseProcessingOptions()` to customize processing:

```typescript
// Plain text response (compression, summarization)
class CompressEntityUseCase extends BaseAIUseCase {
  protected getResponseProcessingOptions(): ResponseProcessingOptions {
    return {
      extractThinkTags: true,     // YES: Extract <think> tags
      extractMarkdown: true,      // YES: Extract markdown blocks
      validateJson: false,        // NO: Skip JSON validation
      cleanJson: false           // NO: Skip JSON cleaning
    };
  }
}

// Keep think tags in content
class DebugUseCase extends BaseAIUseCase {
  protected getResponseProcessingOptions(): ResponseProcessingOptions {
    return {
      extractThinkTags: false  // Keep <think> tags visible
    };
  }
}

// Conservative JSON cleaning
class StrictJsonUseCase extends BaseAIUseCase {
  protected getResponseProcessingOptions(): ResponseProcessingOptions {
    return {
      recipeMode: 'conservative'  // Minimal JSON fixes
    };
  }
}
```

#### Direct Service Usage

You can also use `ResponseProcessorService` directly:

```typescript
import { ResponseProcessorService, ResponseProcessingOptions } from '@loonylabs/llm-middleware';

// Plain text (no JSON processing)
const result = await ResponseProcessorService.processResponseAsync(response, {
  validateJson: false,
  cleanJson: false
});

// Extract markdown but skip JSON
const result2 = await ResponseProcessorService.processResponseAsync(response, {
  extractMarkdown: true,
  validateJson: false
});
```

#### Use Cases

- ✅ **Plain text responses**: Compression, summarization, text generation
- ✅ **Pre-validated JSON**: Skip redundant validation
- ✅ **Debug/analysis**: Keep think tags in content
- ✅ **Performance**: Skip unnecessary processing steps
- ✅ **Custom workflows**: Mix and match extraction features

#### Backward Compatibility

All options are **optional** with sensible defaults. Existing code works without changes:

```typescript
// Still works exactly as before
const result = await ResponseProcessorService.processResponseAsync(response);
```

</details>

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) for the amazing local LLM platform
- The open-source community for inspiration and contributions

## 🔗 Links

- [📚 Documentation](https://github.com/loonylabs-dev/llm-middleware/docs)
- [🐛 Issues](https://github.com/loonylabs-dev/llm-middleware/issues)
- [📦 NPM Package](https://www.npmjs.com/package/llm-middleware)

---

<div align="center">

**Made with ❤️ for the AI community**

[![GitHub stars](https://img.shields.io/github/stars/loonylabs-dev/llm-middleware?style=social)](https://github.com/loonylabs-dev/llm-middleware/stargazers)
[![Follow on GitHub](https://img.shields.io/github/followers/loonylabs-dev?style=social&label=Follow)](https://github.com/loonylabs-dev)

</div>