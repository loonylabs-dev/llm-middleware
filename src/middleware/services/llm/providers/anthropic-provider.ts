import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/utils/logging.utils';
import { BaseLLMProvider } from './base-llm-provider';
import { LLMProvider, CommonLLMResponse, TokenUsage, ReasoningEffort } from '../types';
import {
  AnthropicRequestOptions,
  AnthropicAPIRequest,
  AnthropicAPIResponse,
  AnthropicResponse,
  AnthropicThinkingConfig
} from '../types/anthropic.types';
import { MultimodalContent } from '../types/multimodal.types';
import { LLMDebugger, LLMDebugInfo } from '../utils/debug-llm.utils';
import { DataFlowLoggerService } from '../../data-flow-logger';
import { ThinkingExtractorFactory } from '../thinking';
import { retryWithBackoff } from '../utils/retry.utils';
import { normalizeContent, hasImages, contentToDebugString, contentLength } from '../utils/multimodal.utils';

/**
 * Maps provider-agnostic ReasoningEffort to Anthropic budget_tokens.
 * Returns undefined if thinking should be disabled.
 * @see https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
 */
function mapReasoningEffortToAnthropicBudget(effort: ReasoningEffort): number | undefined {
  switch (effort) {
    case 'none':
      return undefined;  // Disable thinking
    case 'low':
      return 1024;  // Minimum allowed budget
    case 'medium':
      return 8192;
    case 'high':
      return 16384;
    default:
      return undefined;  // Don't enable by default
  }
}

/**
 * Anthropic provider implementation with advanced features:
 * - Comprehensive debugging and logging
 * - Error handling with retry logic
 * - Session management
 * - Parameter handling
 */
export class AnthropicProvider extends BaseLLMProvider {
  private dataFlowLogger: DataFlowLoggerService;
  private readonly API_VERSION = '2023-06-01';
  private readonly BASE_URL = 'https://api.anthropic.com/v1';

  constructor() {
    super(LLMProvider.ANTHROPIC);
    this.dataFlowLogger = DataFlowLoggerService.getInstance();
  }

  /**
   * Call the Anthropic API with a custom system message
   * @param userPrompt - The user's prompt for the model
   * @param systemMessage - The system message defining AI behavior
   * @param options - Options for the API call
   * @returns The API response or null on error
   */
  public async callWithSystemMessage(
    userPrompt: MultimodalContent,
    systemMessage: string,
    options: AnthropicRequestOptions = {}
  ): Promise<CommonLLMResponse | null> {
    const {
      authToken = process.env.ANTHROPIC_API_KEY,
      model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      temperature = 0.7,
      maxTokens = 4096,
      top_p,
      top_k,
      stop_sequences,
      debugContext,
      sessionId = uuidv4(),
      chapterNumber,
      pageNumber,
      pageName,
      reasoningEffort
    } = options;

    // Validate that API key is provided
    if (!authToken) {
      throw new Error(
        'Anthropic API key is required but not provided. ' +
        'Please set ANTHROPIC_API_KEY in your .env file or pass authToken in options.'
      );
    }

    // Validate that model is provided
    if (!model) {
      throw new Error(
        'Model name is required but not provided. ' +
        'Please set ANTHROPIC_MODEL in your .env file or pass model in options.'
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': authToken,
      'anthropic-version': this.API_VERSION
    };

    // Build thinking config if reasoningEffort is specified
    const thinkingBudget = reasoningEffort ? mapReasoningEffortToAnthropicBudget(reasoningEffort) : undefined;
    const thinkingConfig: AnthropicThinkingConfig | undefined = thinkingBudget
      ? { type: 'enabled', budget_tokens: thinkingBudget }
      : undefined;

    // Build message content: multimodal (with images) or plain string
    const messageContent = hasImages(userPrompt)
      ? normalizeContent(userPrompt).map(part => {
          if (part.type === 'text') {
            return { type: 'text' as const, text: part.text };
          }
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: part.mimeType,
              data: part.data
            }
          };
        })
      : (typeof userPrompt === 'string' ? userPrompt : normalizeContent(userPrompt).map(p => (p as { type: 'text'; text: string }).text).join('\n'));

    // Build the request payload
    const requestPayload: AnthropicAPIRequest = {
      model: model,
      messages: [
        { role: 'user', content: messageContent }
      ],
      max_tokens: maxTokens,
      temperature: temperature,
      system: systemMessage,
      ...(top_p !== undefined && { top_p }),
      ...(top_k !== undefined && { top_k }),
      ...(stop_sequences && { stop_sequences }),
      // Add thinking config for extended thinking (Claude 3.5+)
      ...(thinkingConfig && { thinking: thinkingConfig })
    };

    // Get client request body from global scope
    let clientRequestBody: any = undefined;
    try {
      clientRequestBody = (global as any).currentRequestBody;
    } catch (error) {
      // Ignore as it's optional
    }

    // Prepare debug info (use debug string to avoid base64 blobs in logs)
    const userMessageDebug = contentToDebugString(userPrompt);

    const debugInfo: LLMDebugInfo = {
      timestamp: new Date(),
      provider: this.providerName,
      model: model,
      baseUrl: this.BASE_URL,
      systemMessage: systemMessage,
      userMessage: userMessageDebug,
      requestData: requestPayload,
      useCase: debugContext,
      clientRequestBody: clientRequestBody,
      sessionId: sessionId,
      chapterNumber: chapterNumber,
      pageNumber: pageNumber,
      pageName: pageName,
      // Request parameters for logging (since 2.17.0)
      temperature,
      reasoningEffort,
    };

    // Log request
    await LLMDebugger.logRequest(debugInfo);

    // Log to data flow logger
    const contextForLogger = {
      currentChapterNr: chapterNumber,
      currentPage: pageNumber,
      debugContext
    };

    const requestId = this.dataFlowLogger.startRequest(debugContext || 'anthropic-direct', contextForLogger);

    this.dataFlowLogger.logLLMRequest(
      {
        stage: debugContext || 'anthropic-direct',
        prompt: userMessageDebug,
        systemMessage: systemMessage,
        modelName: model,
        temperature: temperature,
        contextInfo: {
          sessionId,
          chapterNumber,
          pageNumber,
          pageName,
          parameters: {
            maxTokens,
            top_p,
            top_k,
            stop_sequences
          }
        }
      },
      contextForLogger,
      requestId
    );

    const requestStartTime = Date.now();

    try {
      logger.info('Sending request to Anthropic API', {
        context: 'AnthropicProvider',
        metadata: {
          url: `${this.BASE_URL}/messages`,
          model: model,
          promptLength: contentLength(userPrompt),
          maxTokens: maxTokens
        }
      });

      const response = await retryWithBackoff(
        () => axios.post<AnthropicAPIResponse>(
          `${this.BASE_URL}/messages`,
          requestPayload,
          {
            headers,
            timeout: 180000 // 180 second timeout
          }
        ),
        this.constructor.name,
        options.retry
      );

      const requestDuration = Date.now() - requestStartTime;

      if (response && response.status === 200) {
        const apiResponse: AnthropicAPIResponse = response.data;

        // Extract text from content blocks
        const rawResponseText = apiResponse.content
          .map(block => block.text)
          .join('\n');

        // Extract thinking using model-specific extractor (Strategy Pattern)
        // Most Anthropic models don't use <think> tags, but this provides
        // consistency and supports potential use via Anthropic-compatible proxies
        const extractor = ThinkingExtractorFactory.forModel(model);
        const { content: responseText, thinking } = extractor.extract(rawResponseText);

        // Normalize token usage to provider-agnostic format
        const tokenUsage: TokenUsage = {
          inputTokens: apiResponse.usage.input_tokens,
          outputTokens: apiResponse.usage.output_tokens,
          totalTokens: apiResponse.usage.input_tokens + apiResponse.usage.output_tokens,
          // Include Anthropic-specific cache metadata if present
          ...(apiResponse.usage.cache_creation_input_tokens || apiResponse.usage.cache_read_input_tokens ? {
            cacheMetadata: {
              cacheCreationTokens: apiResponse.usage.cache_creation_input_tokens,
              cacheReadTokens: apiResponse.usage.cache_read_input_tokens
            }
          } : {})
        };

        // Normalize to CommonLLMResponse format
        const normalizedResponse: AnthropicResponse = {
          message: {
            content: responseText,
            ...(thinking && { thinking })
          },
          sessionId: sessionId,
          metadata: {
            provider: this.providerName,
            model: apiResponse.model,
            tokensUsed: tokenUsage.totalTokens,
            processingTime: requestDuration
          },
          // Standardized token usage
          usage: tokenUsage,
          // Anthropic-specific fields (kept for backward compatibility)
          id: apiResponse.id,
          stop_reason: apiResponse.stop_reason || undefined,
          input_tokens: apiResponse.usage.input_tokens,
          output_tokens: apiResponse.usage.output_tokens
        };

        // Add response info to debug
        debugInfo.responseTimestamp = new Date();
        debugInfo.response = responseText;
        debugInfo.rawResponseData = apiResponse;
        if (thinking) {
          debugInfo.thinking = thinking;
        }

        // Log response (including markdown saving)
        await LLMDebugger.logResponse(debugInfo);

        // Log to data flow logger
        this.dataFlowLogger.logLLMResponse(
          debugContext || 'anthropic-direct',
          {
            rawResponse: responseText,
            processingTime: requestDuration
          },
          contextForLogger,
          requestId
        );

        return normalizedResponse;
      } else {
        const error = new Error(`Status ${response?.status || 'unknown'}`);
        logger.error('Error calling Anthropic API', {
          context: this.constructor.name,
          error: error.message,
          metadata: response?.data || {}
        });

        // Log error to data flow logger
        this.dataFlowLogger.logLLMResponse(
          debugContext || 'anthropic-direct',
          {
            rawResponse: '',
            processingTime: Date.now() - requestStartTime,
            error
          },
          contextForLogger,
          requestId
        );

        return null;
      }
    } catch (error: unknown) {
      // Type-safe error handling
      let errorMessage = 'Unknown error';
      let errorDetails: Record<string, any> = {};

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Check for Axios error and safely extract properties
      if (
        error &&
        typeof error === 'object' &&
        'isAxiosError' in error &&
        error.isAxiosError === true
      ) {
        const axiosError = error as any;

        if (axiosError.response) {
          errorDetails = {
            statusCode: axiosError.response.status,
            statusText: axiosError.response.statusText,
            data: axiosError.response.data
          };

          // Log specific error types
          if (axiosError.response.status === 401) {
            logger.error('Authentication error with Anthropic API', {
              context: this.constructor.name,
              error: 'Invalid API key',
              metadata: {
                statusCode: axiosError.response.status,
                message: axiosError.response.data?.error?.message
              }
            });
          } else if (axiosError.response.status === 429) {
            logger.error('Rate limit exceeded', {
              context: this.constructor.name,
              error: 'Too many requests',
              metadata: {
                statusCode: axiosError.response.status,
                retryAfter: axiosError.response.headers['retry-after']
              }
            });
          } else if (axiosError.response.status === 400) {
            logger.error('Bad request to Anthropic API', {
              context: this.constructor.name,
              error: axiosError.response.data?.error?.message || 'Invalid request',
              metadata: {
                type: axiosError.response.data?.error?.type,
                details: axiosError.response.data?.error
              }
            });
          }
        }
      }

      logger.error('Error in API request', {
        context: this.constructor.name,
        error: errorMessage,
        metadata: {
          ...errorDetails,
          requestModel: model,
          sessionId: sessionId
        }
      });

      // Log error to data flow logger
      this.dataFlowLogger.logLLMResponse(
        debugContext || 'anthropic-direct',
        {
          rawResponse: '',
          processingTime: Date.now() - requestStartTime,
          error: error instanceof Error ? error : new Error(errorMessage)
        },
        contextForLogger,
        requestId
      );

      // Add error info to debug
      debugInfo.responseTimestamp = new Date();
      debugInfo.error = {
        message: errorMessage,
        details: errorDetails
      };

      // Log error
      await LLMDebugger.logError(debugInfo);

      return null;
    }
  }
}

// Export singleton instance
export const anthropicProvider = new AnthropicProvider();

// Export alias
export { AnthropicProvider as AnthropicService };
export { anthropicProvider as anthropicService };
