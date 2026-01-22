import { llmService, LLMProvider } from '../../services/llm';
import { getModelConfig, ModelConfigKey, ValidatedLLMModelConfig } from '../../shared/config/models.config';
import { ResponseProcessorService } from '../../services/response-processor.service';
import { ResponseProcessingOptions } from '../../services/response-processor/types';
import { BaseAIRequest, BaseAIResult } from '../../shared/types/base-request.types';
import { logger } from '../../shared/utils/logging.utils';
import { ModelParameterManagerService, ModelParameterOverrides } from '../../services/model-parameter-manager/model-parameter-manager.service';
import { UseCaseMetricsLoggerService } from '../../services/use-case-metrics-logger';

/**
 * Base abstract class for all AI use cases
 * Provides common functionality and enforces configuration for each use case
 * TPrompt: The type of prompt data (string, object, etc.)
 * TRequest: The request type (must extend BaseAIRequest<TPrompt>)
 * TResult: The result type (must extend BaseAIResult)
 */
export abstract class BaseAIUseCase<
  TPrompt = string,
  TRequest extends BaseAIRequest<TPrompt> = BaseAIRequest<TPrompt>,
  TResult extends BaseAIResult = BaseAIResult
> {
  /**
   * The system message defines the behavior and instructions for the AI model
   * Must be defined by each specific use case
   */
  protected abstract readonly systemMessage: string;

  /**
   * Stores the current request during execution for access in getSystemMessage()
   * @internal
   */
  private _currentRequest?: TRequest;

  /**
   * Get the system message for a specific request.
   * Override this method in child classes to customize the system message per-request.
   * Default implementation returns the static systemMessage property.
   *
   * @param request - The current request (optional for backward compatibility)
   * @returns The system message to use for this request
   *
   * @example
   * ```typescript
   * // Dynamic system message based on request data
   * protected getSystemMessage(request?: MyRequest): string {
   *   const bookType = request?.data?.bookType;
   *   if (bookType) {
   *     return generateSystemMessageForBookType(bookType);
   *   }
   *   return this.systemMessage;
   * }
   * ```
   *
   * @since 2.11.0
   */
  protected getSystemMessage(request?: TRequest): string {
    return this.systemMessage;
  }

  /**
   * Default model configuration key to use across all use cases
   * Can be overridden by specific use cases if needed
   */
  protected static readonly DEFAULT_MODEL_CONFIG_KEY: ModelConfigKey = 'MODEL1';

  /**
   * The model configuration key to use for this specific use case
   * If not overridden, uses the default model config key
   */
  protected get modelConfigKey(): ModelConfigKey {
    return (this.constructor as typeof BaseAIUseCase).DEFAULT_MODEL_CONFIG_KEY;
  }

  /**
   * Get the model configuration for a given key
   * Override this method in subclasses to provide custom model configurations
   *
   * @param key - The model configuration key
   * @returns Validated model configuration
   *
   * @example
   * ```typescript
   * // In your custom use case base class:
   * protected getModelConfigProvider(key: ModelConfigKey): ValidatedLLMModelConfig {
   *   return myCustomGetModelConfig(key);
   * }
   * ```
   */
  protected getModelConfigProvider(key: ModelConfigKey): ValidatedLLMModelConfig {
    return getModelConfig(key);
  }

  /**
   * Get the model configuration for this use case
   * Returns validated config with guaranteed model name
   */
  protected get modelConfig(): ValidatedLLMModelConfig {
    return this.getModelConfigProvider(this.modelConfigKey);
  }

  /**
   * Creates a user message from the prompt
   * Override in child classes for custom formatting
   */
  protected formatUserMessage(prompt: any): string {
    if (typeof prompt === 'string') {
      return prompt;
    }
    
    // Basic JSON formatting for complex prompts
    return JSON.stringify(prompt, null, 2);
  }

  /**
   * Abstract method that each use case MUST implement
   * Returns the specific template function for the use case
   * This enforces the message pattern: each use case should have a corresponding message file
   */
  protected abstract getUserTemplate(): (formattedPrompt: string) => string;

  /**
   * Override model parameters for this specific use case
   * Override this method in child classes to customize parameters
   * @returns Parameter overrides to apply to the default model configuration
   */
  protected getParameterOverrides(): ModelParameterOverrides {
    return {}; // Default: no overrides
  }

  /**
   * Get the LLM provider to use for this use case
   * Override this method in child classes to use different providers (e.g., Anthropic, OpenAI)
   * @returns The LLM provider to use (default: OLLAMA)
   */
  protected getProvider(): LLMProvider {
    return LLMProvider.OLLAMA; // Default: Ollama for backward compatibility
  }

  /**
   * Execute the AI use case
   * @param request The request parameters
   * @returns The result of the AI processing
   */
  public async execute(request: TRequest): Promise<TResult> {
    if (!request.prompt) {
      throw new Error('Valid prompt must be provided');
    }

    // Store current request for getSystemMessage() access
    this._currentRequest = request;

    // Get effective system message (may be dynamic based on request)
    const effectiveSystemMessage = this.getSystemMessage(request);

    // Format the raw prompt using formatUserMessage
    const formattedPrompt = this.formatUserMessage(request.prompt);
    
    // Apply the user template to create the final message
    const userTemplate = this.getUserTemplate();
    const formattedUserMessage = userTemplate(formattedPrompt);
    const startTime = Date.now();
    let success = false;
    let errorMessage = '';
    let thinking = '';

    // Get parameter overrides from the use case
    const overrides = this.getParameterOverrides();

    // Get effective parameters by combining config and overrides
    const effectiveParams = ModelParameterManagerService.getEffectiveParameters(
      {
        temperature: this.modelConfig.temperature
      },
      overrides
    );

    // Validate parameters
    const validatedParams = ModelParameterManagerService.validateParameters(effectiveParams);
    const definedParams = ModelParameterManagerService.getDefinedParameters(validatedParams);

    // Request-level parameters override config/usecase defaults (since 2.17.0)
    // Priority: request > usecase override > model config
    const effectiveTemperature = request.temperature ?? validatedParams.temperature;
    const effectiveReasoningEffort = request.reasoningEffort;

    // Log the start of execution with metrics
    UseCaseMetricsLoggerService.logStart(
      this.constructor.name,
      this.modelConfig.name,
      formattedUserMessage.length,
      effectiveTemperature,
      definedParams
    );

    try {
      // Get the provider for this use case
      const provider = this.getProvider();

      // Call the LLM service with the configured provider
      const result = await llmService.callWithSystemMessage(
        formattedUserMessage,
        effectiveSystemMessage,
        {
          model: this.modelConfig.name,
          temperature: effectiveTemperature,
          authToken: this.modelConfig.bearerToken,
          baseUrl: this.modelConfig.baseUrl,
          provider: provider,
          // Provider-agnostic maxTokens (works for Anthropic, OpenAI, Google, Ollama)
          // Maps from overrides.maxTokens or overrides.num_predict via getEffectiveParameters
          maxTokens: validatedParams.numPredict,
          // Ollama-specific options (includes num_predict, num_ctx, num_batch, etc.)
          ...ModelParameterManagerService.toOllamaOptions(validatedParams),
          // Vertex AI region (passed through to VertexAIProvider)
          ...(this.modelConfig.region && { region: this.modelConfig.region }),
          // Reasoning effort for models that support thinking (Gemini 2.5+, Claude, etc.)
          ...(effectiveReasoningEffort && { reasoningEffort: effectiveReasoningEffort }),
          debugContext: this.constructor.name
        }
      );

      if (!result || !result.message) {
        throw new Error('No response received from the LLM provider');
      }

      // Process the response using processResponse() method (uses getResponseProcessingOptions())
      const { cleanedJson: processedContent, thinking: extractedThinking } =
        await this.processResponse(result.message.content);

      // TODO: Refactor needed - see docs/plan-thinking-extraction-refactoring.md
      // Currently thinking comes from ResponseProcessor (<think> tags).
      // Provider-level thinking (result.message.thinking) is not yet integrated.
      // This will be fixed in the ThinkingExtractor refactoring.
      thinking = extractedThinking;
      success = true;

      // Extract actual token counts from provider response if available
      let actualTokens: { inputTokens?: number; outputTokens?: number } | undefined;

      if (result.usage) {
        // Use standardized usage field (provider-agnostic)
        actualTokens = {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens
        };
      }

      // Calculate and log metrics
      const metrics = UseCaseMetricsLoggerService.calculateMetrics(
        startTime,
        effectiveSystemMessage,
        formattedUserMessage,
        result.message.content,
        thinking,
        this.modelConfig.name,
        success,
        errorMessage,
        definedParams,
        actualTokens  // Pass actual tokens from provider
      );

      // Log completion with metrics
      UseCaseMetricsLoggerService.logCompletion(this.constructor.name, metrics);

      // Create the business result from concrete implementation
      const businessResult = this.createResult(
        processedContent,
        formattedUserMessage,
        extractedThinking
      );

      // Attach usage metadata to result (library responsibility since 2.13.0)
      // This ensures consistent token/cost data across all use cases
      const finalResult = {
        ...businessResult,
        usage: result.usage
      } as TResult;

      return finalResult;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Calculate metrics for failed execution
      const metrics = UseCaseMetricsLoggerService.calculateMetrics(
        startTime,
        effectiveSystemMessage,
        formattedUserMessage,
        '',
        thinking,
        this.modelConfig.name,
        false,
        errorMessage,
        definedParams
      );

      // Log completion with error
      UseCaseMetricsLoggerService.logCompletion(this.constructor.name, metrics);

      throw error;
    }
  }

  /**
   * Get response processing options for this use case
   * Override in specific use cases to customize processing behavior
   *
   * @returns Options for response processing
   *
   * @example
   * ```typescript
   * // For plain text responses (compression, summarization)
   * protected getResponseProcessingOptions(): ResponseProcessingOptions {
   *   return {
   *     extractThinkTags: true,     // YES: Extract <think> tags
   *     extractMarkdown: true,      // YES: Extract markdown blocks
   *     validateJson: false,        // NO: Skip JSON validation
   *     cleanJson: false           // NO: Skip JSON cleaning
   *   };
   * }
   *
   * // For conservative JSON cleaning
   * protected getResponseProcessingOptions(): ResponseProcessingOptions {
   *   return {
   *     recipeMode: 'conservative'
   *   };
   * }
   * ```
   *
   * @since 2.8.0
   */
  protected getResponseProcessingOptions(): ResponseProcessingOptions {
    // Default: Use all features (backward compatible)
    return {};
  }

  /**
   * Process the raw AI response using the modern Recipe System
   * Can be overridden by specific use cases if special processing is needed
   *
   * @since 2.8.0 - Now uses getResponseProcessingOptions() for configurable processing
   */
  protected async processResponse(response: string): Promise<{ cleanedJson: string; thinking: string }> {
    const options = this.getResponseProcessingOptions();
    return ResponseProcessorService.processResponseAsync(response, options);
  }

  /**
   * Create the result object
   * This is a template method to be implemented by specific use cases.
   *
   * NOTE: Token usage and cost information is automatically attached to the result
   * by the base class execute() method. Concrete implementations should focus on
   * business logic only.
   *
   * @param content The processed content to use for the result
   * @param usedPrompt The formatted prompt that was used
   * @param thinking Optional thinking content from the model
   *
   * @since 2.13.0 - BREAKING: Removed usage parameter. Usage is now automatically
   * attached by execute() method. See CHANGELOG for migration guide.
   */
  protected abstract createResult(
    content: string,
    usedPrompt: string,
    thinking?: string
  ): TResult;
}