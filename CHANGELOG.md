## [2.12.1] - 2025-12-08

### 🐛 Bug Fix: Currency Correction in Cost Tracking

**Fixed:**
- Corrected currency references from EUR to USD in cost tracking documentation and code comments
- Updated `TokenUsage.cost` field documentation to correctly indicate USD (industry standard for AI API pricing)
- All cost examples in documentation now show USD instead of EUR

**Why USD?**
While Requesty.ai is EU-based, the industry standard for AI API pricing is USD (following OpenAI, Anthropic, etc.). The cost field reports values in USD as provided by the Requesty.ai API.

**Files Updated:**
- `src/middleware/services/llm/types/common.types.ts` - Comment correction
- `CHANGELOG.md` - Documentation correction
- `docs/LLM_PROVIDERS.md` - Documentation correction

---

## [2.12.0] - 2025-12-08

### 🚀 Feature: Requesty.AI Provider Integration

This release adds comprehensive support for Requesty.AI, enabling DSGVO-compliant access to 300+ AI models including EU-hosted OpenAI models through a single unified API.

#### Added

- **Requesty.AI Provider (`RequestyProvider`)**: Complete implementation following the established provider pattern
  - OpenAI-compatible API integration (`/v1/chat/completions`)
  - EU-specific router: `https://router.eu.requesty.ai/v1` for DSGVO compliance
  - Comprehensive error handling (401, 429, 400) with three-level logging
  - Token usage normalization (OpenAI format → `TokenUsage` interface)
  - Singleton export pattern with backward-compatible aliases

- **Cost Tracking**: New optional `cost` field in `TokenUsage` interface
  - Transparent cost tracking for providers that support it
  - Currently supported by Requesty.AI provider
  - Backward compatible (optional field, undefined for other providers)
  - Cost reported in USD as provided by the API

- **Model Agnosticity**: Access any model available through Requesty.AI
  - Format: `provider/model-name` (e.g., `openai/gpt-4o`, `anthropic/claude-3-5-sonnet`, `vertex/gemini-2.5-flash-lite@europe-central2`)
  - No provider-specific model validation
  - Automatic routing through Requesty.AI gateway

- **Global Timeout Increase**: All providers now use 180s timeout (previously 90s)
  - Provides buffer for multi-hop gateway latency
  - Applies to: Anthropic, Gemini, Ollama, and Requesty providers

- **Test Infrastructure**: Added Requesty provider smoke test
  - New npm script: `test:provider:requesty`
  - Integrated into existing `provider-smoke-test.ts`
  - Comprehensive validation of API calls, logging, and token usage

#### Configuration

New environment variables:
```bash
REQUESTY_API_KEY=your_requesty_api_key_here
REQUESTY_MODEL=openai/gpt-4o  # Default model (format: provider/model-name)
```

#### Benefits

- **DSGVO Compliance**: EU-hosted OpenAI models for data privacy requirements
- **Unified Access**: One API key for 300+ models across multiple providers
- **Cost Transparency**: Built-in cost tracking in USD
- **Provider Flexibility**: Easy switching between local (Ollama) and cloud providers (Requesty, Anthropic, Gemini)
- **Model Agnostic**: Use any model without code changes

#### Usage Example

```typescript
import { LLMService, LLMProvider } from '@loonylabs/llm-middleware';

const llmService = new LLMService();

const response = await llmService.callWithSystemMessage(
  'Hello, who are you?',
  'You are a helpful assistant',
  {
    provider: LLMProvider.REQUESTY,
    model: 'openai/gpt-4o',  // or 'anthropic/claude-3-5-sonnet', 'vertex/gemini-2.5-flash-lite@europe-central2', etc.
    authToken: process.env.REQUESTY_API_KEY
  }
);

// Response includes cost information
console.log(response.usage.cost); // e.g., 0.0000024 USD
```

#### Technical Details

**Files Added:**
- `src/middleware/services/llm/providers/requesty-provider.ts` (320 lines)
- `src/middleware/services/llm/types/requesty.types.ts` (59 lines)

**Files Modified:**
- `src/middleware/services/llm/types/common.types.ts` - Added `REQUESTY` enum value and `cost` field to `TokenUsage`
- `src/middleware/services/llm/llm.service.ts` - Registered RequestyProvider
- `src/middleware/services/llm/providers/index.ts` - Exported RequestyProvider
- `src/middleware/services/llm/types/index.ts` - Exported Requesty types
- `src/middleware/services/llm/providers/anthropic-provider.ts` - Timeout increase
- `src/middleware/services/llm/providers/ollama-provider.ts` - Timeout increase (4 locations)
- `src/middleware/services/llm/providers/gemini-provider.ts` - Timeout increase
- `.env.example` - Added Requesty configuration section
- `tests/manual/provider-smoke-test.ts` - Added Requesty test case
- `package.json` - Added `test:provider:requesty` script

**Pattern Conformity:**
- Follows existing provider architecture (BaseLLMProvider)
- Three-level logging (console logger, DataFlowLogger, LLMDebugger)
- Standard error handling pattern (return `null` on errors)
- Normalized response format (CommonLLMResponse)

---

## [2.11.0] - 2025-12-04

### Feature: Dynamic System Messages via `getSystemMessage(request)`

This release adds the ability to customize system messages per-request, enabling dynamic system message generation based on request data.

#### Added

- **`getSystemMessage(request?)` method in `BaseAIUseCase`**: Override this method in child classes to customize the system message for each request. Default implementation returns the static `systemMessage` property for backward compatibility.
- **`_currentRequest` internal property**: Stores the current request during execution for access in `getSystemMessage()`.

#### Benefits

- Dynamic system messages based on request context (e.g., book type, user preferences)
- Backward compatible - existing use cases work without changes
- Full access to request data when generating system messages

### Usage Example

```typescript
class MyDynamicUseCase extends BaseAIUseCase<MyPrompt, MyRequest, MyResult> {
  protected readonly systemMessage = "Default system message";

  // Override to customize system message per-request
  protected getSystemMessage(request?: MyRequest): string {
    const bookType = request?.data?.bookType;
    if (bookType === 'technical') {
      return generateTechnicalSystemMessage(bookType);
    }
    return this.systemMessage;
  }
}
```

---

## [2.10.0] - 2025-11-20

### ✨ Feature: Pass LLM Usage Data to AI Results

This release enhances the `BaseAIUseCase` to propagate detailed LLM usage information (like input/output tokens and estimated cost) directly to the `BaseAIResult` object. This ensures that downstream applications, such as `scribomate`, can accurately log and utilize actual token counts from the AI model's response, rather than relying on fallback values.

#### Added

- **`usage` parameter in `BaseAIUseCase.createResult()`**: The abstract method `createResult` now includes an optional `usage` parameter, allowing concrete use cases to receive comprehensive token usage data.
- **`usage` property in `BaseAIResult` interface**: The `BaseAIResult` interface has been extended with an optional `usage` property to type-safely carry the LLM usage information.
- **Propagation of `result.usage`**: The `execute` method in `BaseAIUseCase` now passes the `result.usage` object directly to the `createResult` method.

#### Benefits

- ✅ **Accurate Token Logging**: Enables applications to log actual token counts from LLM responses, resolving issues where fallback values were incorrectly stored.
- ✅ **Improved Cost Tracking**: Provides necessary data for precise cost accounting and credit deduction in consuming applications.
- ✅ ✅ **Enhanced Data Flow**: Ensures that valuable LLM usage metadata is consistently available throughout the application's data processing pipeline.

### Migration Guide

**No breaking changes** for existing implementations that do not utilize the new `usage` parameter or property.

**For concrete `BaseAIUseCase` implementations:**
If your custom use case needs access to the LLM usage data, update your `createResult` method signature to include the new `usage` parameter:

```typescript
protected createResult(
  content: string,
  usedPrompt: string,
  thinking?: string,
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; estimatedCostUsd?: number; }
): MyCustomResult {
  const result: MyCustomResult = {
    // ... other properties
    usage, // Assign the usage data
  };
  return result;
}
```

**For custom `BaseAIResult` extensions:**
If you have custom result interfaces extending `BaseAIResult` and wish to store the usage data, ensure your interface explicitly includes the `usage` property:

```typescript
export interface MyCustomResult extends BaseAIResult {
  // ... other properties
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
  };
}
```

---
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.9.0] - 2025-11-11

### ✨ Feature: Google Gemini Provider Support

This release adds complete support for **Google Gemini** as a new LLM provider, expanding the middleware's multi-provider architecture.

#### What's New

- **✅ Google Gemini Provider**: Full integration with Google's Gemini API
  - Support for all Gemini models (gemini-1.5-pro, gemini-1.5-flash, etc.)
  - Complete request/response handling with proper type definitions
  - Normalized token usage reporting
  - Comprehensive error handling and logging
  - Session management and debugging support

#### Provider Features

```typescript
import { llmService, LLMProvider, geminiProvider } from '@loonylabs/llm-middleware';

// Use via LLM Service orchestrator
const response = await llmService.call(
  "Explain quantum computing",
  {
    provider: LLMProvider.GOOGLE,
    model: "gemini-1.5-pro",
    authToken: process.env.GEMINI_API_KEY,
    maxTokens: 1024,
    temperature: 0.7
  }
);

// Or use Gemini provider directly
const response2 = await geminiProvider.callWithSystemMessage(
  "Write a story",
  "You are a creative writer",
  {
    model: "gemini-1.5-pro",
    authToken: process.env.GEMINI_API_KEY,
    maxOutputTokens: 2048,
    topP: 0.95,
    topK: 40,
    temperature: 0.9
  }
);
```

#### Configuration

Add to your `.env` file:

```env
# Google Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-pro
```

#### Gemini-Specific Parameters

- `topP`: Nucleus sampling (0.0 to 1.0)
- `topK`: Top-K sampling
- `stopSequences`: Custom stop sequences
- `candidateCount`: Number of response variations
- `maxOutputTokens`: Maximum tokens to generate

#### Architecture

**New Files:**
- `src/middleware/services/llm/types/gemini.types.ts` - Gemini-specific type definitions
- `src/middleware/services/llm/providers/gemini-provider.ts` - Gemini provider implementation

**Updated Files:**
- `src/middleware/services/llm/providers/index.ts` - Export Gemini provider
- `src/middleware/services/llm/types/index.ts` - Export Gemini types
- `src/middleware/services/llm/llm.service.ts` - Register Gemini provider
- `README.md` - Updated documentation with Gemini examples
- `package.json` - Version bump to 2.9.0

#### Provider Support Matrix

| Provider | Status | Models |
|----------|--------|--------|
| Ollama | ✅ Fully Supported | All local models |
| Anthropic Claude | ✅ Fully Supported | Opus, Sonnet, Haiku |
| Google Gemini | ✅ Fully Supported | Pro, Flash |
| OpenAI | 🔜 Planned | - |

#### Benefits

- 🌐 **Multi-Provider Flexibility**: Choose the best model for your use case
- 🔄 **Consistent Interface**: Same API across all providers
- 📊 **Normalized Responses**: Provider-agnostic token usage and metadata
- 🔧 **Provider-Specific Features**: Access Gemini-specific parameters when needed
- 🛡️ **Type Safety**: Full TypeScript support with proper type definitions

### Migration Guide

**No breaking changes** - Existing code continues to work without modifications.

**To use Gemini:**

1. Add your Gemini API key to `.env`
2. Use `LLMProvider.GOOGLE` in your requests
3. Optionally use Gemini-specific parameters

```typescript
// In your use case
class MyGeminiUseCase extends BaseAIUseCase {
  protected getProvider(): LLMProvider {
    return LLMProvider.GOOGLE;
  }
}
```

---

## [2.8.1] - 2025-11-10

### Fixed

**Critical Bug Fix:** `getResponseProcessingOptions()` was never called

#### Problem

In v2.8.0, the `BaseAIUseCase.execute()` method called `ResponseProcessorService.processResponseAsync()` **directly**, bypassing the `processResponse()` method entirely. This meant:

- ❌ `getResponseProcessingOptions()` was **never called**
- ❌ Use cases could not customize response processing
- ❌ Plain text responses (compression, summarization) were still truncated by JSON cleaner

```typescript
// ❌ v2.8.0 - Direct call (wrong!)
const { cleanedJson, thinking } =
  await ResponseProcessorService.processResponseAsync(result.message.content);
```

#### Solution

Changed `execute()` to call `this.processResponse()` instead, which properly uses `getResponseProcessingOptions()`:

```typescript
// ✅ v2.8.1 - Uses processResponse() (correct!)
const { cleanedJson, thinking } =
  await this.processResponse(result.message.content);
```

Now use cases can properly customize processing by overriding `getResponseProcessingOptions()`.

### Impact

This fix enables the v2.8.0 feature to actually work as intended. Users who upgraded to v2.8.0 and tried to use `getResponseProcessingOptions()` should upgrade to v2.8.1 immediately.

---

## [2.8.0] - 2025-11-10

### ✨ Feature: Configurable Response Processing Options

This release adds flexible configuration options for response processing, allowing use cases to selectively enable/disable JSON cleaning, markdown extraction, and think tag extraction.

#### Problem

Previously, `ResponseProcessorService.processResponseAsync()` always applied the full processing pipeline (think tag extraction → markdown extraction → JSON cleaning/validation) regardless of the use case requirements.

This caused issues for:
- **Plain text responses** (compression, summarization): JSON cleaner truncated multi-paragraph text
- **Pre-validated JSON**: Unnecessary cleaning overhead
- **Custom processing needs**: No way to keep `<think>` tags in content

**Example Issue:**
```typescript
// ❌ Before v2.8.0: Plain text was truncated by JSON cleaner
const response = `Paragraph 1\n\nParagraph 2\n\nParagraph 3`;
const result = await ResponseProcessorService.processResponseAsync(response);
// Result: Only "Paragraph 1" (truncated by JSON validation failure)
```

### Added

#### `ResponseProcessingOptions` Interface

New configurable options for granular control over response processing:

```typescript
interface ResponseProcessingOptions {
  extractThinkTags?: boolean;    // default: true
  extractMarkdown?: boolean;     // default: true
  validateJson?: boolean;        // default: true
  cleanJson?: boolean;           // default: true
  recipeMode?: 'conservative' | 'aggressive' | 'adaptive';  // default: 'adaptive'
}
```

#### Updated `ResponseProcessorService`

- `processResponseAsync()` now accepts optional `options` parameter
- Conditional processing based on options
- **100% backward compatible** - existing calls work unchanged

```typescript
// Plain text responses (compression use case)
const result = await ResponseProcessorService.processResponseAsync(response, {
  extractThinkTags: true,
  extractMarkdown: true,
  validateJson: false,  // Skip JSON validation
  cleanJson: false     // Skip JSON cleaning
});

// Custom processing
const result = await ResponseProcessorService.processResponseAsync(response, {
  extractThinkTags: false,  // Keep <think> in content
  recipeMode: 'conservative'
});
```

#### Enhanced `BaseAIUseCase`

New protected method for use cases to customize processing:

```typescript
protected getResponseProcessingOptions(): ResponseProcessingOptions {
  return {};  // Default: full processing (backward compatible)
}
```

Use cases override this to customize behavior:

```typescript
// In CompressEntityUseCase
protected getResponseProcessingOptions(): ResponseProcessingOptions {
  return {
    extractThinkTags: true,     // YES: Extract <think> tags
    extractMarkdown: true,      // YES: Extract markdown blocks
    validateJson: false,        // NO: Skip JSON validation
    cleanJson: false           // NO: Skip JSON cleaning
  };
}
```

### Changed

#### `processResponse()` in BaseAIUseCase

- Now calls `getResponseProcessingOptions()` to get options
- Passes options to `ResponseProcessorService.processResponseAsync()`
- **Backward compatible** - default options maintain existing behavior

### Benefits

- ✅ **Granular control** - Enable/disable features independently
- ✅ **Plain text support** - No more truncation by JSON cleaner
- ✅ **Performance** - Skip unnecessary processing
- ✅ **Flexibility** - Keep think tags when needed
- ✅ **100% backward compatible** - No breaking changes

### Migration Guide

**No breaking changes** - existing code continues to work without modifications.

**For plain text use cases (compression, summarization):**

```typescript
// Override in your use case
protected getResponseProcessingOptions(): ResponseProcessingOptions {
  return {
    validateJson: false,
    cleanJson: false
  };
}
```

**For custom think tag handling:**

```typescript
protected getResponseProcessingOptions(): ResponseProcessingOptions {
  return {
    extractThinkTags: false  // Keep <think> tags in content
  };
}
```

### Testing

- 15 comprehensive tests covering all option combinations
- Plain text response handling
- Markdown extraction (with/without)
- Think tag extraction (with/without)
- Combined extraction scenarios
- Edge cases (empty response, whitespace, nested blocks)
- Backward compatibility verification

---

## [2.7.0] - 2025-11-09

### ✨ Feature: Provider-Agnostic `maxTokens` Parameter

This release adds provider-agnostic `maxTokens` support to `ModelParameterOverrides`, following the same design pattern used in `CommonLLMOptions`. Use cases can now set maximum output tokens regardless of the underlying LLM provider.

#### Problem
Previously, `ModelParameterOverrides` only supported Ollama-specific parameters (`num_predict`, `num_ctx`, `num_batch`), making it impossible to set token limits for Anthropic/OpenAI providers via `getParameterOverrides()`.

**Example Issue:**
```typescript
// ❌ Before v2.7.0: Only worked for Ollama
protected getParameterOverrides(): ModelParameterOverrides {
  return {
    num_predict: 16384  // Anthropic ignored this!
  };
}
```

### Added

#### Provider-Agnostic `maxTokens` in ModelParameterOverrides
- **New field**: `maxTokens?: number` - works across all providers
- **Provider mapping:**
  - Anthropic: `maxTokens` → `max_tokens`
  - OpenAI: `maxTokens` → `max_tokens`
  - Ollama: `maxTokens` → `num_predict`
  - Google: `maxTokens` → `maxOutputTokens`

#### Enhanced ModelParameterManagerService
- `getEffectiveParameters()` now maps `maxTokens` → `numPredict`
- **Fallback logic**: `num_predict` takes precedence over `maxTokens` for Ollama power users
- Comprehensive JSDoc documentation for provider mapping

#### Updated BaseAIUseCase
- Passes `maxTokens` to `llmService.callWithSystemMessage()`
- Automatically works with all providers (Anthropic, OpenAI, Ollama, Google)
- Maps from `validatedParams.numPredict` (which includes `maxTokens`)

### Changed

#### Deprecated `num_predict` in ModelParameterOverrides
- **Still works** for backward compatibility
- **Recommended**: Use `maxTokens` for cross-provider code
- Only use `num_predict` for Ollama-specific fine-tuning

### Usage Example

```typescript
// ✅ After v2.7.0: Works for all providers!
protected getParameterOverrides(): ModelParameterOverrides {
  return {
    maxTokens: 16384  // Anthropic, OpenAI, Ollama, Google
  };
}
```

### Benefits
- ✅ **Provider-agnostic design** - consistent with `CommonLLMOptions`
- ✅ **Simplified use case code** - single parameter works everywhere
- ✅ **Backward compatible** - existing `num_predict` usage still works
- ✅ **Advanced control** - Ollama users can still use `num_predict` for fine-tuning

### Migration Guide

**No breaking changes** - existing code continues to work.

**Recommended updates:**
```typescript
// Old (still works)
protected getParameterOverrides(): ModelParameterOverrides {
  return { num_predict: 8192 };
}

// New (recommended - provider-agnostic)
protected getParameterOverrides(): ModelParameterOverrides {
  return { maxTokens: 8192 };
}
```

---

## [2.6.0] - 2025-11-09

### ✨ Feature: Provider-Agnostic Token Usage Tracking

This release implements accurate token counting by using actual values from LLM provider APIs instead of estimations.

#### Problem
Token counts were estimated using `TokenEstimatorService`, causing significant discrepancies between reported metrics and actual API usage (up to 30% error rate).

**Example Discrepancy:**
```
Anthropic API:  input_tokens: 2301, output_tokens: 1241
Backend logs:   Input tokens: 1592, Output tokens: 882
Difference:     ~30% error
```

### Added

#### New Token Usage Interface (`common.types.ts`)
- **`TokenUsage` interface**: Provider-agnostic token usage information
  - `inputTokens`: Number of tokens in the input/prompt
  - `outputTokens`: Number of tokens in the output/completion
  - `totalTokens`: Total tokens (inputTokens + outputTokens)
  - `cacheMetadata`: Optional cache-related token counts (Anthropic prompt caching support)

#### Extended CommonLLMResponse
- Added optional `usage?: TokenUsage` field
- Providers populate this with actual token counts from their APIs
- Backward compatible - field is optional

### Changed

#### Provider Updates
- **AnthropicProvider** (`anthropic-provider.ts`):
  - Normalizes `usage.input_tokens` → `usage.inputTokens`
  - Normalizes `usage.output_tokens` → `usage.outputTokens`
  - Includes Anthropic-specific cache metadata (`cache_creation_input_tokens`, `cache_read_input_tokens`)

- **OllamaProvider** (`ollama-provider.ts`):
  - Normalizes `prompt_eval_count` → `usage.inputTokens`
  - Normalizes `eval_count` → `usage.outputTokens`

#### Enhanced Metrics Calculation (`use-case-metrics-logger.service.ts`)
- `calculateMetrics()` now accepts optional `actualTokens` parameter
- **Prefers actual token counts from provider** over estimation
- **Falls back to `TokenEstimatorService`** if actual tokens unavailable
- Fully backward compatible

#### BaseAIUseCase Integration (`base-ai.usecase.ts`)
- Automatically extracts `usage` from provider responses
- Passes actual token counts to metrics calculation
- Works seamlessly with all providers (Anthropic, Ollama, future OpenAI/Google)

### Impact

**Before v2.6.0:**
```
Token counting: Estimation-based (30% error rate)
Cost tracking:  Inaccurate
```

**After v2.6.0:**
```
Token counting: API-accurate (0% error)
Cost tracking:  Precise
Backend logs:   Match API responses exactly
```

### Benefits
- ✅ **Accurate token tracking** for precise cost monitoring
- ✅ **Provider-agnostic API design** - works across all LLM providers
- ✅ **Backward compatible** - estimation fallback for providers without token info
- ✅ **Prompt caching support** - includes Anthropic cache metadata
- ✅ **Zero breaking changes** - purely additive enhancement

### Compatibility
- **No Breaking Changes**: All existing code continues to work
- New optional parameter with graceful fallback
- Works with Anthropic, Ollama, and future providers (OpenAI, Google)

---

## [2.5.0] - 2025-11-08

### 🔧 Enhancement: Recipe System Optimization for Arrays

This release fixes a critical issue in the Recipe System where the MissingCommaFixer corrupted valid JSON arrays during processing.

### Fixed

#### Recipe System - MissingCommaFixer (`src/middleware/services/json-cleaner/recipe-system/operations/fixers.ts`)
- **Invalid JSON Modification**: The `shouldApply()` method was too aggressive, running on already-valid JSON
  - Regex patterns for missing comma detection matched valid multi-line JSON formatting
  - Resulted in adding unnecessary commas to valid arrays, breaking them
  - Example: Complex nested arrays from LLM responses were corrupted during Recipe processing

**Solution**:
- Added validity check in `shouldApply()`: Now tests if JSON is already valid before applying fixes
- Fixers only run on invalid JSON, never modify valid JSON
- Ensures Recipe System prioritizes preservation over modification

### Impact

**Before v2.5.0**:
- Recipe System failed on large/complex arrays (fell back to JsonExtractor)
- 2 tests skipped in v2.4.0

**After v2.5.0**:
- Recipe System (aggressive/adaptive) handles arrays perfectly
- **186/186 unit tests pass** (was 180/182 in v2.4.0)
- No fallback needed - Recipe System is now primary path for all JSON types

### Tests Fixed

Re-enabled and now passing:
- ✅ `should extract complex JSON array with aggressive recipe`
- ✅ `should extract complex JSON array from markdown code block (real-world narrative data)`

### Tests Added

- `tests/unit/json-cleaner/debug-recipe-steps.test.ts`
  - Step-by-step fixer validation
  - Identified MissingCommaFixer as root cause
  - Ensures each Recipe step preserves valid JSON

### Compatibility

- **No Breaking Changes**: Pure enhancement
- All v2.4.0 functionality preserved
- Recipe System now preferred over fallback for all JSON types
- Backward compatible with all existing use cases

---

## [2.4.0] - 2025-11-08

### 🐛 Bug Fix: JSON Array Extraction Support

This release fixes a critical bug in the JsonExtractor parser where JSON arrays were not properly extracted from LLM responses.

### Fixed

#### JsonExtractor Parser (`src/middleware/services/json-cleaner/parsers/json-extractor.parser.ts`)
- **Array Extraction Bug**: The `extractJsonBlock()` method only searched for objects `{...}`, causing it to extract only the first object from arrays `[{...}, {...}]` instead of the complete array
  - Now properly handles both objects `{...}` and arrays `[...]`
  - Maintains separate counters for braces and brackets to correctly identify complete JSON structures
  - Tracks the starting character (`{` or `[`) to ensure matching closing character

- **Pattern Matching Enhancement**: The `extractByPattern()` method now includes array-specific patterns
  - Added Pattern 2: JSON array after "response:", "result:", etc.
  - Added Pattern 4: JSON array in the middle of text
  - Both patterns complement existing object patterns

### Impact

This fix resolves issues where:
- LLM responses containing JSON arrays were truncated to single objects
- Array-based use cases (e.g., generating multiple narrative structures) failed silently
- Fallback to legacy orchestrator was triggered unnecessarily

### Tests Added

- `tests/unit/json-cleaner/json-extractor-array.test.ts`: Comprehensive test suite for array extraction
  - Simple array extraction
  - Markdown-wrapped arrays
  - Complex nested arrays (real-world narrative data)
  - Arrays with surrounding text

### Compatibility

- **No Breaking Changes**: This is a pure bug fix
- All existing tests continue to pass (180/182 unit tests passing)
- Backward compatible with all existing use cases

---

## [2.3.0] - 2025-11-08

### 🔧 Enhanced Extensibility: Custom Model Configuration Provider

This release introduces the **Protected Method Pattern** for model configuration, allowing consumers to easily override where model configurations come from without breaking existing code.

### Added

#### BaseAIUseCase - New Method
- **`getModelConfigProvider(key: ModelConfigKey): ValidatedLLMModelConfig`**
  - Protected method that can be overridden in subclasses to provide custom model configurations
  - Enables use cases like:
    - Multi-environment deployments (dev, staging, production)
    - Dynamic model selection based on runtime conditions
    - Loading model configs from external sources (database, API, config service)
    - Testing with different model configurations
  - Comprehensive JSDoc with usage examples

#### Examples
- **Custom Config Example** (`src/examples/custom-config/`)
  - `CustomConfigUseCase`: Demonstrates basic custom config provider pattern
  - `EnvironmentAwareUseCase`: Shows environment-based model selection (NODE_ENV)
  - Complete documentation in example README

#### Tests
- **Model Config Provider Tests** (`tests/unit/usecases/base-ai-usecase.test.ts`)
  - Default behavior validation
  - Custom provider override tests
  - Backward compatibility tests (old pattern still works)
  - Edge case testing (validation, error handling)

### Changed

#### BaseAIUseCase
- **`modelConfig` getter**: Now calls `getModelConfigProvider()` internally (backward compatible)
  - Old pattern (overriding `modelConfig` getter directly) still works
  - New pattern (overriding `getModelConfigProvider()`) is cleaner and recommended

### Documentation
- **README.md**: New "Customizing Model Configuration" section in Advanced Features
- **Example README**: Complete guide for the custom-config example
- **JSDoc**: Comprehensive documentation with code examples

### Migration Guide

**No breaking changes.** Existing code continues to work without modifications.

**New Pattern (Recommended):**
```typescript
export class MyCustomUseCase extends BaseAIUseCase<TPrompt, TRequest, TResult> {
  // Override to use custom model configuration source
  protected getModelConfigProvider(key: ModelConfigKey): ValidatedLLMModelConfig {
    return myCustomGetModelConfig(key);
  }
}
```

**Old Pattern (Still Supported):**
```typescript
export class MyUseCase extends BaseAIUseCase<TPrompt, TRequest, TResult> {
  // Still works, but not recommended
  protected get modelConfig(): ValidatedLLMModelConfig {
    return myCustomGetModelConfig(this.modelConfigKey);
  }
}
```

**Benefits of New Pattern:**
- Cleaner separation of concerns
- More flexible (can use the key parameter)
- Easier to test and mock
- Better for inheritance hierarchies

---

## [2.2.0] - 2025-11-08

### 🎯 Breaking Changes: Provider Abstraction in BaseAIUseCase

This release makes BaseAIUseCase truly provider-agnostic, allowing use cases to easily switch between different LLM providers (Ollama, Anthropic, OpenAI, Google).

### Changed

#### BaseAIUseCase
- **BREAKING**: Replaced hard-coded `ollamaService` with provider-agnostic `llmService`
  - Now uses `llmService.callWithSystemMessage()` with provider parameter
  - Each use case can override `getProvider()` to specify which LLM provider to use
  - Default provider: `LLMProvider.OLLAMA` (backward compatible)

#### New Methods
- **`getProvider(): LLMProvider`**: Override in child classes to select provider
  - Example: `return LLMProvider.ANTHROPIC` for Anthropic Claude
  - Example: `return LLMProvider.OLLAMA` for Ollama models
  - Enables per-use-case provider selection

### Added
- **Provider Selection**: Use cases can now easily switch providers
  ```typescript
  protected getProvider(): LLMProvider {
    return LLMProvider.ANTHROPIC; // Use Claude instead of Ollama
  }
  ```

### Migration Guide

**Before (v2.1.0):**
```typescript
export class MyUseCase extends BaseAIUseCase<TRequest, TResult> {
  // Hard-coded Ollama usage
}
```

**After (v2.2.0):**
```typescript
export class MyUseCase extends BaseAIUseCase<TPrompt, TRequest, TResult> {
  // Override to use different provider
  protected getProvider(): LLMProvider {
    return LLMProvider.ANTHROPIC; // or OLLAMA, OPENAI, GOOGLE
  }
}
```

**Backward Compatibility**: Existing use cases continue to work without changes (default: OLLAMA)

---

## [2.1.0] - 2025-11-07

### 🚀 New Provider: Anthropic Claude Support

This release adds full support for Anthropic Claude models, making llm-middleware truly multi-provider.

### Added

#### Anthropic Provider
- **AnthropicProvider**: Complete implementation for Anthropic Claude API
  - Support for all Claude models (Opus, Sonnet, Haiku)
  - Lightweight implementation using axios (no SDK dependency)
  - Full compatibility with existing logging and debugging infrastructure
  - Session management and error handling
- **Type Definitions**: Comprehensive TypeScript types for Anthropic API
  - `AnthropicRequestOptions`: Request configuration
  - `AnthropicResponse`: Normalized response format
  - `AnthropicAPIRequest/Response`: Raw API types
- **Environment Configuration**:
  - `ANTHROPIC_API_KEY`: API key configuration
  - `ANTHROPIC_MODEL`: Default model selection (e.g., claude-3-5-sonnet-20241022)

#### Testing
- **Parametrized Provider Tests**: Unified test infrastructure
  - `tests/manual/provider-smoke-test.ts`: Single test for all providers
  - `npm run test:provider:ollama`: Test Ollama provider
  - `npm run test:provider:anthropic`: Test Anthropic provider
  - Environment-based provider selection via `TEST_PROVIDER`

#### Logging
- **Provider-Specific Logs**: Automatic log separation by provider
  - `logs/llm/anthropic/requests/`: Anthropic API logs
  - Same debug features as Ollama (request/response, thinking extraction, metrics)

### Changed

#### LLMService
- **Provider Registration**: AnthropicProvider automatically registered
  - Available via `LLMProvider.ANTHROPIC` enum
  - Access via `llmService.getProvider(LLMProvider.ANTHROPIC)`

#### Documentation
- Updated `.env.example` with Anthropic configuration
- All provider-related types exported from types index

### Usage

```typescript
import { LLMService, LLMProvider } from '@loonylabs/llm-middleware';

const llmService = new LLMService();

// Use Anthropic Claude
const response = await llmService.call('Hello!', {
  provider: LLMProvider.ANTHROPIC,
  model: 'claude-3-5-sonnet-20241022',
  authToken: process.env.ANTHROPIC_API_KEY,
  maxTokens: 1024
});

// Or get provider directly
const anthropic = llmService.getProvider(LLMProvider.ANTHROPIC);
const response = await anthropic.call('Hello!', {
  model: 'claude-3-5-sonnet-20241022',
  authToken: process.env.ANTHROPIC_API_KEY
});
```

### Roadmap

#### Planned for v2.2+
- OpenAI Provider implementation
- Google Gemini Provider
- Unified parameter mapping across providers
- Streaming support for all providers

---

## [2.0.0] - 2025-11-07

### 🚀 Major Release: Multi-Provider Architecture

**BREAKING CHANGE**: Package renamed from `@loonylabs/ollama-middleware` to `@loonylabs/llm-middleware`

This release introduces a complete architectural refactoring to support multiple LLM providers while maintaining backward compatibility with existing Ollama implementations.

### Added

#### Multi-Provider Architecture
- **Provider Strategy Pattern**: Clean separation between different LLM providers
- **LLMService Orchestrator**: Unified interface for all LLM providers
- **Provider-Agnostic Types**: Common interfaces for requests, responses, and debugging
- **Extensible Design**: Easy to add new providers (OpenAI, Anthropic, Google planned for v2.1+)

#### New Modules
- `providers/`: Provider implementations
  - `base-llm-provider.ts`: Abstract base class for all providers
  - `ollama-provider.ts`: Ollama implementation (previously OllamaService)
- `types/`: Type definitions
  - `common.types.ts`: Provider-agnostic types
  - `ollama.types.ts`: Ollama-specific types
- `llm.service.ts`: Main orchestrator service

#### Provider-Agnostic Logging
- Logs now organized by provider: `logs/llm/{provider}/requests/`
- Debug utilities support multiple providers
- Environment variables: `DEBUG_LLM_REQUESTS`, `DEBUG_LLM_MINIMAL`, etc.

### Changed

#### Package Name
- **BREAKING**: Package renamed from `@loonylabs/ollama-middleware` to `@loonylabs/llm-middleware`
- Repository moved from `ollama-middleware` to `llm-middleware`
- All documentation updated to reflect multi-provider focus

#### Service Architecture
- `OllamaService` → `OllamaProvider` (backward compatible exports maintained)
- New `LLMService` for provider-agnostic access
- `OllamaDebugger` → `LLMDebugger` (backward compatible)

#### Log Structure
- Old: `logs/ollama/requests/`
- New: `logs/llm/ollama/requests/`

### Backward Compatibility

**All existing code continues to work!** The following exports are maintained:

```typescript
// Old imports still work:
import { OllamaService, ollamaService } from '@loonylabs/llm-middleware';

// Equivalent new imports:
import { OllamaProvider, ollamaProvider } from '@loonylabs/llm-middleware';
```

### Migration Guide

#### For Existing Users (v1.x → v2.0)

**Step 1: Update Package Name**
```bash
npm uninstall @loonylabs/ollama-middleware
npm install @loonylabs/llm-middleware
```

**Step 2: Update Imports** (Optional - backward compatible)
```typescript
// Old (still works):
import { OllamaService, ollamaService } from '@loonylabs/llm-middleware';

// New (recommended):
import { OllamaProvider, ollamaProvider } from '@loonylabs/llm-middleware';

// Or use the new LLM Service:
import { LLMService, llmService } from '@loonylabs/llm-middleware';
```

**Step 3: Update Environment Variables** (Optional)
```bash
# Old:
DEBUG_OLLAMA_REQUESTS=true
DEBUG_OLLAMA_MINIMAL=true

# New (backward compatible):
DEBUG_LLM_REQUESTS=true
DEBUG_LLM_MINIMAL=true
```

**No other changes required!** Your existing code will continue to work without modifications.

### Documentation

#### Updated
- README.md: Multi-provider focus, updated examples
- GETTING_STARTED.md: New provider architecture
- All docs: `ollama-middleware` → `llm-middleware`

#### New
- docs/LLM_PROVIDERS.md: Guide for adding new providers
- Provider-specific documentation structure

### Roadmap

#### Planned for v2.1+
- OpenAI Provider implementation
- Anthropic Claude Provider
- Google Gemini Provider
- Unified parameter mapping across providers

---

## [1.3.0] - 2025-11-01

### Changed

#### Package Naming & Organization
- **BREAKING**: Package renamed from `llm-middleware` to `@loonylabs/llm-middleware`
  - Now part of the @loonylabs npm organization
  - Improved discoverability and branding
  - All import statements updated: `from '@loonylabs/llm-middleware'`

#### Documentation
- **README**: Updated all npm badges and links to use scoped package name
- **README**: Updated installation instructions to use `@loonylabs/llm-middleware`
- **README**: Updated all code examples with new import statements

### Migration Guide

To upgrade from `llm-middleware` to `@loonylabs/llm-middleware`:

1. Update your `package.json`:
   ```diff
   - "llm-middleware": "^1.2.1"
   + "@loonylabs/llm-middleware": "^1.3.0"
   ```

2. Update all import statements in your code:
   ```diff
   - import { BaseAIUseCase } from 'llm-middleware';
   + import { BaseAIUseCase } from '@loonylabs/llm-middleware';
   ```

3. Run `npm install` to install the new package

## [1.2.1] - 2025-10-26

### Fixed

#### Documentation
- **README**: Corrected GitHub username from `planichttm` to `loonylabs-dev`
  - Fixed GitHub stars badge URL
  - Fixed GitHub follow badge URL

## [1.2.0] - 2025-10-26

### Added

#### Distribution & Publishing
- **npm Publication**: Package now available on npm registry
  - Install via `npm install llm-middleware`
  - Optimized package size (only production files included)
  - `prepublishOnly` script ensures build and tests run before publishing
  - Added `.env.example` to package files for configuration reference

#### Package Metadata
- **Enhanced Keywords**: Added `chatbot`, `api`, `async`, `streaming`, `response-processing`
  - Improves discoverability on npm
  - Better reflects package capabilities

### Changed

#### Documentation
- **README**: Updated installation instructions
  - npm installation as primary method
  - GitHub installation as alternative
  - Added npm version and download badges
  - Updated TypeScript version badge to 5.7+
  - Streamlined badge layout for better visibility

#### Build & Release
- **Package Configuration**: Optimized for npm distribution
  - `files` field includes only: `dist/`, `README.md`, `LICENSE`, `.env.example`
  - Excludes: `src/`, `tests/`, `docs/`, development configs
  - Smaller install footprint for end users

## [1.1.0] - 2025-10-26

### Added

#### Response Processing
- **ResponseProcessorService.processResponseAsync()**: Modern async method using Recipe System
  - Automatic recipe selection (conservative, aggressive, adaptive)
  - Intelligent fallback to legacy orchestrator
  - Better error handling and quality metrics
- **43 new unit tests for ResponseProcessorService**: Comprehensive test coverage
  - `extractThinking()`, `extractContent()`, `hasValidJson()`
  - `tryParseJson()`, `processResponseAsync()`
  - `extractAllThinkingTypes()`, `formatForHuman()`
  - `extractMetadata()`, `validateResponse()`, `processResponseDetailed()`
  - Total: 155 unit tests (was 114, +41 tests)

#### JSON Cleaning
- **Modern Recipe System**: Fully integrated as primary cleaning method
  - Automatic content analysis and recipe suggestion
  - Conservative mode for valid JSON preservation
  - Aggressive mode for heavily malformed content
  - Adaptive mode with intelligent strategy selection
  - Detailed quality scores and metrics

### Changed

#### Architecture - BREAKING CHANGE
- **Async-only API**: All synchronous methods removed in favor of async
  - `JsonCleanerService.processResponseAsync()` is now the only processing method
  - `ResponseProcessorService.processResponseAsync()` is the primary API
  - `ResponseProcessorService.tryParseJson()` is now async
  - `ResponseProcessorService.processResponseDetailed()` is now async
- **BaseAIUseCase**: Migrated to async processing
  - Uses `processResponseAsync()` internally
  - All use cases automatically benefit from Recipe System

#### Services
- **ResponseProcessorService**: Consolidated from duplicate implementations
  - Removed duplicate `response-processor/` directory (43 lines)
  - Single source of truth: `response-processor.service.ts` (283 lines)
  - Fixed inconsistency between production and test code
- **Service Export Structure**: Unified and consistent service exports
  - Added `index.ts` for `use-case-metrics-logger` service
  - Exported `data-flow-logger` and `use-case-metrics-logger` in services index
  - Standardized import paths across all services
  - All 8 services now follow consistent export pattern
  - Removed legacy placeholder comments from middleware index
- **Exports**: Simplified middleware exports
  - Changed from individual service exports to unified `export * from './services'`
  - Cleaner and more maintainable structure

#### Tests
- **test-middleware.js**: Migrated to async IIFE pattern
- **test-json-handling.js**: Migrated to async/await throughout
- **response-processor.service.test.ts**: Updated for async-only API
- All 155 unit tests passing (100%)
- Basic tests: 6/6 passing (100%)
- Robustness tests: 93% overall score

#### Documentation
- **Recipe System README**: Updated to reflect async-only API
  - Removed deprecation warnings
  - Clarified modern approach
  - Updated code examples

### Removed - BREAKING CHANGE

#### Deprecated Methods
- **JsonCleanerService.processResponse()**: Removed synchronous method
  - Use `processResponseAsync()` instead
  - Legacy orchestrator still available as internal fallback
- **ResponseProcessorService.processResponse()**: Removed synchronous method
  - Use `processResponseAsync()` instead
- **JsonCleanerService.fixDuplicateKeysInJson()**: Removed unused method
  - Recipe System handles duplicate keys automatically
- **JsonCleanerService.formatMessage()**: Removed trivial method
  - Was only calling `.trim()` - use `String.prototype.trim()` directly

#### Code Cleanup
- Removed duplicate ResponseProcessorService directory (-43 lines)
- Removed 4 deprecated/unused methods (-60 lines total)
- Removed 2 sync test cases that are no longer relevant

### Fixed

- **Production/Test inconsistency**: Fixed issue where BaseAIUseCase used different ResponseProcessorService than tests
- **Import paths**: Corrected BaseAIUseCase to use consolidated ResponseProcessorService
- **Type safety**: All async methods properly typed with Promise returns

### Migration Guide

#### Breaking Changes

**Before (v1.0.0):**
```typescript
// Synchronous API
const result = JsonCleanerService.processResponse(json);
const result = ResponseProcessorService.processResponse(response);
const parsed = ResponseProcessorService.tryParseJson(response);
```

**After (v1.1.0+):**
```typescript
// Async-only API (REQUIRED)
const result = await JsonCleanerService.processResponseAsync(json);
const result = await ResponseProcessorService.processResponseAsync(response);
const parsed = await ResponseProcessorService.tryParseJson(response);
const detailed = await ResponseProcessorService.processResponseDetailed(response);
```

#### Automatic Migration

**If you use BaseAIUseCase**: No changes needed! All use cases that extend `BaseAIUseCase` are automatically migrated and use the async API.

#### Manual Migration Required

**If you use services directly**: Update all calls to use async methods and add `await`:
- Replace `processResponse()` with `await processResponseAsync()`
- Add `await` to `tryParseJson()` and `processResponseDetailed()`
- Ensure calling functions are `async` or handle promises

### Technical Details

#### Code Metrics
- **Total lines removed**: ~103 lines (deprecated code + duplicates)
- **Total lines added**: ~413 lines (new tests)
- **Net change**: +310 lines (mostly tests)
- **Test coverage**: +43 tests (+38% increase)
- **Deprecated methods removed**: 4
- **API methods**: 100% async

#### Performance
- Recipe System provides better JSON cleaning quality
- Non-blocking async I/O for improved scalability
- Intelligent recipe selection based on content analysis
- Fallback guarantee ensures robustness

#### Quality Metrics
- Unit tests: 155/155 passing (100%)
- Basic tests: 6/6 passing (100%)
- Robustness score: 93%
- Build: Success
- Type safety: Full TypeScript coverage

---

## [1.0.0] - 2025-10-17

### Added

#### Parameters & Configuration
- **num_ctx parameter**: Context window size configuration (128-4096+ tokens)
- **num_batch parameter**: Parallel token processing configuration (1-512)
- **Comprehensive JSDoc**: All parameters now have inline documentation with ranges and defaults
- **Parameter validation**: `num_ctx` minimum 128, `num_batch` minimum 1

#### Request Formatting
- **RequestFormatterService**: Generic service for complex nested prompts
  - Handles string, object, and nested prompt structures
  - Automatic context/instruction separation
  - FlatFormatter integration for context formatting
  - `extractContext()` and `extractInstruction()` methods
  - Support for flexible field names (`instruction`, `userInstruction`, `task`, etc.)
  - Backward-compatible `extractUserInstruction()` alias

#### Examples
- **StoryGeneratorUseCase**: Demonstrates RequestFormatterService with complex prompts
  - Supports multiple prompt formats (string/object/nested)
  - Extracts context and instruction in results
  - Uses Creative Writing preset (temperature 0.85)
  - Includes manual test script (`tests/manual/story-generator-test.ts`)

#### Performance Monitoring
- **UseCaseMetricsLoggerService**: Automatic performance tracking
  - Execution time measurement
  - Token usage estimation (input/output)
  - Generation speed calculation (tokens/sec)
  - Parameter logging
  - Success/failure tracking with error messages
  - Integrated into `BaseAIUseCase` for all use cases

#### Testing
- **RequestFormatterService unit tests**: 22 new tests covering all methods
  - Prompt formatting (string, object, nested, arrays)
  - Context/instruction extraction
  - Validation and sanitization
  - Utility methods
- **Total test count**: 105 unit tests passing

#### Documentation
- **REQUEST_FORMATTING.md**: Complete guide for FlatFormatter vs RequestFormatterService
- **PERFORMANCE_MONITORING.md**: Guide for metrics and token tracking
- **CHANGELOG.md**: Release notes and breaking changes
- **OLLAMA_PARAMETERS.md**: Updated with `num_predict`, `num_ctx`, `num_batch`
- **README.md**: Links to new documentation

### Changed

#### Services
- **RequestFormatterService**: Now domain-agnostic
  - Removed `bookContext` field dependency
  - Generic `context`, `sessionContext`, `metadata` fields
  - Uses FlatFormatter for context formatting
  - More flexible extraction logic

- **BaseAIUseCase**: Enhanced with metrics logging
  - Automatic `UseCaseMetricsLoggerService` integration
  - Logs start and completion with metrics
  - Parameter tracking in all requests

- **ModelParameterManagerService**:
  - `getEffectiveParameters()` includes `numCtx` and `numBatch`
  - `validateParameters()` validates new parameters
  - `getDefinedParameters()` logs new parameters
  - `toOllamaOptions()` forwards `num_ctx` and `num_batch` to API

### Fixed

- Parameter forwarding to Ollama API now includes all configured parameters
- Context extraction handles nested `prompt.prompt` structures correctly
- Validation ensures minimum values for `num_ctx` and `num_batch`

---

## Compatibility

### Node.js
- **Minimum**: 18.0.0
- **Recommended**: 20.x or later

### TypeScript
- **Minimum**: 4.9.0
- **Recommended**: 5.x or later

### Ollama
- **Minimum**: Any version with `/api/chat` endpoint
- **Recommended**: Latest stable release


## Links

- [GitHub Repository](https://github.com/loonylabs-dev/llm-middleware)
- [Documentation](https://github.com/loonylabs-dev/llm-middleware/docs)
- [Issues](https://github.com/loonylabs-dev/llm-middleware/issues)
- [Discussions](https://github.com/loonylabs-dev/llm-middleware/discussions)
