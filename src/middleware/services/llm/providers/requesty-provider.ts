// NEW FILE: requesty-provider.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/utils/logging.utils';
import { BaseLLMProvider } from './base-llm-provider';
import { LLMProvider, CommonLLMResponse, TokenUsage } from '../types';
import {
  RequestyRequestOptions,
  RequestyAPIRequest,
  RequestyAPIResponse,
  RequestyResponse
} from '../types/requesty.types';
import { LLMDebugger, LLMDebugInfo } from '../utils/debug-llm.utils';
import { DataFlowLoggerService } from '../../data-flow-logger';

/**
 * Requesty.ai provider implementation
 * Provides access to 300+ models via unified OpenAI-compatible API
 * Includes EU-hosted OpenAI models for DSGVO compliance
 */
export class RequestyProvider extends BaseLLMProvider {
  private dataFlowLogger: DataFlowLoggerService;
  private readonly BASE_URL = 'https://router.eu.requesty.ai/v1';

  constructor() {
    super(LLMProvider.REQUESTY);
    this.dataFlowLogger = DataFlowLoggerService.getInstance();
  }

  /**
   * Call Requesty API with custom system message
   */
  public async callWithSystemMessage(
    userPrompt: string,
    systemMessage: string,
    options: RequestyRequestOptions = {}
  ): Promise<CommonLLMResponse | null> {
    const {
      authToken = process.env.REQUESTY_API_KEY,
      model = process.env.REQUESTY_MODEL || 'openai/gpt-4o',
      temperature = 0.7,
      maxTokens = 4096,
      httpReferer,
      xTitle,
      debugContext,
      sessionId = uuidv4(),
      chapterNumber,
      pageNumber,
      pageName
    } = options;

    // Validate API key
    if (!authToken) {
      throw new Error(
        'Requesty API key is required but not provided. ' +
        'Please set REQUESTY_API_KEY in your .env file or pass authToken in options.'
      );
    }

    // Validate model
    if (!model) {
      throw new Error(
        'Model name is required but not provided. ' +
        'Please set REQUESTY_MODEL in your .env file or pass model in options.'
      );
    }

    // Build headers
    // Accept header is required for Bedrock models and standard for all JSON APIs
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    if (httpReferer) headers['HTTP-Referer'] = httpReferer;
    if (xTitle) headers['X-Title'] = xTitle;

    // Build request payload (OpenAI format)
    const requestPayload: RequestyAPIRequest = {
      model: model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature: temperature
    };

    // Prepare debug info
    const debugInfo: LLMDebugInfo = {
      timestamp: new Date(),
      provider: this.providerName,
      model: model,
      baseUrl: this.BASE_URL,
      systemMessage: systemMessage,
      userMessage: userPrompt,
      requestData: requestPayload,
      useCase: debugContext,
      sessionId: sessionId,
      chapterNumber: chapterNumber,
      pageNumber: pageNumber,
      pageName: pageName
    };

    // Log request
    await LLMDebugger.logRequest(debugInfo);

    const contextForLogger = {
      currentChapterNr: chapterNumber,
      currentPage: pageNumber,
      debugContext
    };

    const requestId = this.dataFlowLogger.startRequest(
      debugContext || 'requesty-direct',
      contextForLogger
    );

    this.dataFlowLogger.logLLMRequest(
      {
        stage: debugContext || 'requesty-direct',
        prompt: userPrompt,
        systemMessage: systemMessage,
        modelName: model,
        temperature: temperature,
        contextInfo: { sessionId, chapterNumber, pageNumber, pageName }
      },
      contextForLogger,
      requestId
    );

    const requestStartTime = Date.now();

    try {
      logger.info('Sending request to Requesty API', {
        context: 'RequestyProvider',
        metadata: {
          url: `${this.BASE_URL}/chat/completions`,
          model: model,
          promptLength: userPrompt.length,
          maxTokens: maxTokens
        }
      });

      const response = await axios.post<RequestyAPIResponse>(
        `${this.BASE_URL}/chat/completions`,
        requestPayload,
        {
          headers,
          timeout: 180000 // 180 second timeout
        }
      );

      const requestDuration = Date.now() - requestStartTime;

      if (response && response.status === 200) {
        const apiResponse: RequestyAPIResponse = response.data;

        // Extract text from choices
        const responseText = apiResponse.choices[0]?.message?.content || '';

        // Normalize token usage
        const tokenUsage: TokenUsage = {
          inputTokens: apiResponse.usage.prompt_tokens,
          outputTokens: apiResponse.usage.completion_tokens,
          totalTokens: apiResponse.usage.total_tokens,
          ...(apiResponse.usage.cost !== undefined && { costUsd: apiResponse.usage.cost })
        };

        // Normalize response
        const normalizedResponse: RequestyResponse = {
          message: {
            content: responseText
          },
          sessionId: sessionId,
          metadata: {
            provider: this.providerName,
            model: apiResponse.model,
            tokensUsed: tokenUsage.totalTokens,
            processingTime: requestDuration
          },
          usage: tokenUsage,
          id: apiResponse.id,
          finish_reason: apiResponse.choices[0]?.finish_reason || undefined
        };

        // Update debug info
        debugInfo.responseTimestamp = new Date();
        debugInfo.response = responseText;
        debugInfo.rawResponseData = apiResponse;

        // Log response
        await LLMDebugger.logResponse(debugInfo);

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'requesty-direct',
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
        logger.error('Error calling Requesty API', {
          context: this.constructor.name,
          error: error.message,
          metadata: response?.data || {}
        });

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'requesty-direct',
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
      let errorMessage = 'Unknown error';
      let errorDetails: Record<string, any> = {};

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Handle Axios errors
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

          // Handle specific HTTP status codes
          if (axiosError.response.status === 401) {
            logger.error('Authentication error with Requesty API', {
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
            logger.error('Bad request to Requesty API', {
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

      this.dataFlowLogger.logLLMResponse(
        debugContext || 'requesty-direct',
        {
          rawResponse: '',
          processingTime: Date.now() - requestStartTime,
          error: error instanceof Error ? error : new Error(errorMessage)
        },
        contextForLogger,
        requestId
      );

      debugInfo.responseTimestamp = new Date();
      debugInfo.error = {
        message: errorMessage,
        details: errorDetails
      };

      await LLMDebugger.logError(debugInfo);

      return null;
    }
  }
}

// Export singleton instance
export const requestyProvider = new RequestyProvider();

// Export aliases for backward compatibility
export { RequestyProvider as RequestyService };
export { requestyProvider as requestyService };
