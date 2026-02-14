import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/utils/logging.utils';
import { BaseLLMProvider } from './base-llm-provider';
import { LLMProvider, CommonLLMResponse, TokenUsage } from '../types';
import { OllamaRequestOptions, OllamaResponse } from '../types/ollama.types';
import { MultimodalContent } from '../types/multimodal.types';
import { LLMDebugger, LLMDebugInfo } from '../utils/debug-llm.utils';
import { DataFlowLoggerService } from '../../data-flow-logger';
import { ThinkingExtractorFactory } from '../thinking';
import { retryWithBackoff } from '../utils/retry.utils';
import { extractTextContent, contentToDebugString, contentLength } from '../utils/multimodal.utils';

/**
 * Ollama provider implementation with advanced features:
 * - Comprehensive debugging and logging
 * - Retry logic with authentication fallbacks
 * - Session management
 * - Parameter handling
 * - Error recovery strategies
 */
export class OllamaProvider extends BaseLLMProvider {
  private dataFlowLogger: DataFlowLoggerService;

  constructor() {
    super(LLMProvider.OLLAMA);
    this.dataFlowLogger = DataFlowLoggerService.getInstance();
  }

  /**
   * Call the Ollama API with a custom system message
   * @param userPrompt - The user's prompt for the model
   * @param systemMessage - The system message defining AI behavior
   * @param options - Options for the API call (including token and sessionId)
   * @returns The API response or null on error
   */
  public async callWithSystemMessage(
    userPrompt: MultimodalContent,
    systemMessage: string,
    options: OllamaRequestOptions = {}
  ): Promise<CommonLLMResponse | null> {
    const {
      authToken,
      model,
      temperature = 0.7,
      baseUrl = process.env.MODEL1_URL || "http://localhost:11434",
      repeat_penalty,
      top_p,
      top_k,
      frequency_penalty,
      presence_penalty,
      repeat_last_n,
      num_predict,
      debugContext,
      sessionId = uuidv4(),
      chapterNumber,
      pageNumber,
      pageName
    } = options;

    // Validate that model is provided
    if (!model) {
      throw new Error(
        'Model name is required but not provided. ' +
        'Please ensure MODEL1_NAME is set in your .env file or pass model explicitly in options.'
      );
    }

    // Ollama uses text-only messages; extract text content from multimodal input
    const textContent = extractTextContent(userPrompt);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Create base data without session_id
    const baseData = {
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: textContent }
      ],
      temperature: temperature,
      stream: false,
      options: {
        ...(repeat_penalty !== undefined && { repeat_penalty }),
        ...(top_p !== undefined && { top_p }),
        ...(top_k !== undefined && { top_k }),
        ...(frequency_penalty !== undefined && { frequency_penalty }),
        ...(presence_penalty !== undefined && { presence_penalty }),
        ...(repeat_last_n !== undefined && { repeat_last_n }),
        ...(num_predict !== undefined && { num_predict })
      }
    };

    // Add session_id if it should be used
    const data = {
      ...baseData,
      session_id: sessionId
    };

    // Get client request body from global scope
    let clientRequestBody: any = undefined;
    try {
      clientRequestBody = (global as any).currentRequestBody;
    } catch (error) {
      // Ignore as it's optional
    }

    // Prepare debug info
    const userMessageDebug = contentToDebugString(userPrompt);

    const debugInfo: LLMDebugInfo = {
      timestamp: new Date(),
      provider: this.providerName,
      model: model,
      baseUrl: baseUrl,
      systemMessage: systemMessage,
      userMessage: userMessageDebug,
      requestData: data,
      useCase: debugContext,
      clientRequestBody: clientRequestBody,
      sessionId: sessionId,
      chapterNumber: chapterNumber,
      pageNumber: pageNumber,
      pageName: pageName
    };

    // Log request
    await LLMDebugger.logRequest(debugInfo);

    // Log to data flow logger
    const contextForLogger = {
      currentChapterNr: chapterNumber,
      currentPage: pageNumber,
      debugContext
    };

    const requestId = this.dataFlowLogger.startRequest(debugContext || 'ollama-direct', contextForLogger);

    this.dataFlowLogger.logLLMRequest(
      {
        stage: debugContext || 'ollama-direct',
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
            repeat_penalty,
            top_p,
            top_k,
            frequency_penalty,
            presence_penalty,
            repeat_last_n,
            num_predict
          }
        }
      },
      contextForLogger,
      requestId
    );

    const requestStartTime = Date.now();

    try {
      logger.info('Sending request to Ollama API', {
        context: 'OllamaProvider',
        metadata: {
          url: `${baseUrl}/api/chat`,
          model: model,
          hasAuthToken: !!authToken,
          promptLength: contentLength(userPrompt)
        }
      });

      const response = await retryWithBackoff(
        () => axios.post(`${baseUrl}/api/chat`, data, {
          headers,
          timeout: 180000 // 180 second timeout
        }),
        this.constructor.name,
        options.retry
      );
      const requestDuration = Date.now() - requestStartTime;

      if (response && response.status === 200) {
        const aiResponse: OllamaResponse = response.data;

        // Normalize token usage to provider-agnostic format
        // Ollama provides prompt_eval_count (input) and eval_count (output)
        const inputTokens = aiResponse.prompt_eval_count || 0;
        const outputTokens = aiResponse.eval_count || 0;

        const tokenUsage: TokenUsage = {
          inputTokens: inputTokens,
          outputTokens: outputTokens,
          totalTokens: inputTokens + outputTokens
        };

        // Add session ID to response
        aiResponse.sessionId = sessionId;

        // Add metadata
        aiResponse.metadata = {
          provider: this.providerName,
          model: model,
          tokensUsed: tokenUsage.totalTokens,
          processingTime: requestDuration
        };

        // Add standardized token usage
        aiResponse.usage = tokenUsage;

        // Add response info
        debugInfo.responseTimestamp = new Date();
        debugInfo.response = aiResponse.message.content;
        debugInfo.rawResponseData = aiResponse;

        // Extract thinking using model-specific extractor (Strategy Pattern)
        // DeepSeek R1 and similar models use <think> tags in their responses
        const extractor = ThinkingExtractorFactory.forModel(model);
        const { content: cleanContent, thinking } = extractor.extract(aiResponse.message.content);

        // Update message with separated content and thinking
        aiResponse.message.content = cleanContent;
        if (thinking) {
          aiResponse.message.thinking = thinking;
          debugInfo.thinking = thinking;
        }

        // Log response (including markdown saving)
        await LLMDebugger.logResponse(debugInfo);

        // Log to data flow logger
        this.dataFlowLogger.logLLMResponse(
          debugContext || 'ollama-direct',
          {
            rawResponse: aiResponse.message.content,
            processingTime: requestDuration
          },
          contextForLogger,
          requestId
        );

        return aiResponse;
      } else {
        const error = new Error(`Status ${response?.status || 'unknown'}`);
        logger.error('Error calling Ollama API', {
          context: this.constructor.name,
          error: error.message,
          metadata: response?.data || {}
        });

        // Log error to data flow logger
        this.dataFlowLogger.logLLMResponse(
          debugContext || 'ollama-direct',
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

          // Check for session ID related errors
          if (axiosError.response.status === 400 &&
              typeof axiosError.response.data === 'object' &&
              axiosError.response.data?.error?.includes('session_id')) {
            logger.warn('Session ID not supported in this Ollama version', {
              context: this.constructor.name,
              error: axiosError.response.data?.error,
              metadata: { sessionId }
            });

            // Retry without session_id
            try {
              const retryResponse = await axios.post(`${baseUrl}/api/chat`, baseData, { headers });
              if (retryResponse && retryResponse.status === 200) {
                const aiResponse = retryResponse.data;
                // Add session ID for internal tracking anyway
                aiResponse.sessionId = sessionId;

                // Extract thinking using model-specific extractor
                const retryExtractor = ThinkingExtractorFactory.forModel(model);
                const { content: retryCleanContent, thinking: retryThinking } = retryExtractor.extract(aiResponse.message.content);

                aiResponse.message.content = retryCleanContent;
                if (retryThinking) {
                  aiResponse.message.thinking = retryThinking;
                }

                debugInfo.responseTimestamp = new Date();
                debugInfo.response = retryCleanContent;
                debugInfo.rawResponseData = aiResponse;
                if (retryThinking) {
                  debugInfo.thinking = retryThinking;
                }

                await LLMDebugger.logResponse(debugInfo);

                // Log successful retry to data flow logger
                this.dataFlowLogger.logLLMResponse(
                  debugContext || 'ollama-direct',
                  {
                    rawResponse: retryCleanContent,
                    processingTime: Date.now() - requestStartTime
                  },
                  contextForLogger,
                  requestId
                );

                return aiResponse;
              }
            } catch (retryError) {
              // Error in retry, continue with original error
              logger.error('Retry also failed', {
                context: this.constructor.name,
                error: retryError instanceof Error ? retryError.message : 'Unknown retry error'
              });
            }
          }

          // Check for auth errors specifically
          if (axiosError.response.status === 401 || axiosError.response.status === 403) {
            logger.error('Authentication error with Ollama API', {
              context: this.constructor.name,
              error: 'Invalid or missing authentication token',
              metadata: {
                baseUrl,
                hasToken: !!authToken,
                statusCode: axiosError.response.status
              }
            });

            // Retry strategy ladder:
            // 1) Authorization: <raw token>
            if (authToken) {
              try {
                const headersRawAuth: Record<string, string> = {
                  'Content-Type': 'application/json',
                  'Authorization': authToken
                };
                const retryRaw = await axios.post(`${baseUrl}/api/chat`, baseData, {
                  headers: headersRawAuth,
                  timeout: 180000
                });
                if (retryRaw && retryRaw.status === 200) {
                  return this.handleSuccessfulResponse(retryRaw.data, debugInfo, sessionId, requestStartTime, debugContext, contextForLogger, requestId, model);
                }
              } catch (retryRawErr) {
                logger.warn('Retry with raw Authorization header failed', {
                  context: this.constructor.name,
                  error: retryRawErr instanceof Error ? retryRawErr.message : 'Unknown'
                });
              }
            }

            // 2) X-API-Key header
            if (authToken) {
              try {
                const headersApiKey: Record<string, string> = {
                  'Content-Type': 'application/json',
                  'X-API-Key': authToken
                };
                const retryApiKey = await axios.post(`${baseUrl}/api/chat`, baseData, {
                  headers: headersApiKey,
                  timeout: 180000
                });
                if (retryApiKey && retryApiKey.status === 200) {
                  return this.handleSuccessfulResponse(retryApiKey.data, debugInfo, sessionId, requestStartTime, debugContext, contextForLogger, requestId, model);
                }
              } catch (retryKeyErr) {
                logger.warn('Retry with X-API-Key header failed', {
                  context: this.constructor.name,
                  error: retryKeyErr instanceof Error ? retryKeyErr.message : 'Unknown'
                });
              }
            }

            // 3) No auth (for dev instances)
            try {
              const headersNoAuth: Record<string, string> = { 'Content-Type': 'application/json' };
              const retryAuthless = await axios.post(`${baseUrl}/api/chat`, baseData, {
                headers: headersNoAuth,
                timeout: 180000
              });
              if (retryAuthless && retryAuthless.status === 200) {
                return this.handleSuccessfulResponse(retryAuthless.data, debugInfo, sessionId, requestStartTime, debugContext, contextForLogger, requestId, model);
              }
            } catch (retryAuthlessError) {
              logger.error('Authless retry failed', {
                context: this.constructor.name,
                error: retryAuthlessError instanceof Error ? retryAuthlessError.message : 'Unknown authless retry error'
              });
            }
          }
        }
      }

      logger.error('Error in API request', {
        context: this.constructor.name,
        error: errorMessage,
        metadata: {
          ...errorDetails,
          requestModel: model,
          baseUrl: baseUrl,
          sessionId: sessionId
        }
      });

      // Log error to data flow logger
      this.dataFlowLogger.logLLMResponse(
        debugContext || 'ollama-direct',
        {
          rawResponse: '',
          processingTime: Date.now() - requestStartTime,
          error: error instanceof Error ? error : new Error(errorMessage)
        },
        contextForLogger,
        requestId
      );

      // Add error info
      debugInfo.responseTimestamp = new Date();
      debugInfo.error = {
        message: errorMessage,
        details: errorDetails
      };

      // Log error
      await LLMDebugger.logError(debugInfo);

      // Check for memory errors in response
      const errorResponseData = errorDetails.data;
      if (
        errorResponseData &&
        typeof errorResponseData === 'object' &&
        'error' in errorResponseData &&
        typeof errorResponseData.error === 'string'
      ) {
        const errorText = errorResponseData.error;
        if (
          errorText.includes('model requires more system memory') ||
          errorText.includes('model request too large for system')
        ) {
          throw new Error(`Insufficient memory to load model ${model}. Try closing other applications or using a smaller model.`);
        }
      }

      return null;
    }
  }

  /**
   * Helper method to handle successful responses consistently
   */
  private async handleSuccessfulResponse(
    aiResponse: any,
    debugInfo: LLMDebugInfo,
    sessionId: string,
    requestStartTime: number,
    debugContext: string | undefined,
    contextForLogger: any,
    requestId: string,
    model: string
  ): Promise<OllamaResponse> {
    aiResponse.sessionId = sessionId;

    // Extract thinking using model-specific extractor
    const extractor = ThinkingExtractorFactory.forModel(model);
    const { content: cleanContent, thinking } = extractor.extract(aiResponse.message.content);

    aiResponse.message.content = cleanContent;
    if (thinking) {
      aiResponse.message.thinking = thinking;
    }

    debugInfo.responseTimestamp = new Date();
    debugInfo.response = cleanContent;
    debugInfo.rawResponseData = aiResponse;
    if (thinking) {
      debugInfo.thinking = thinking;
    }

    await LLMDebugger.logResponse(debugInfo);

    this.dataFlowLogger.logLLMResponse(
      debugContext || 'ollama-direct',
      {
        rawResponse: cleanContent,
        processingTime: Date.now() - requestStartTime
      },
      contextForLogger,
      requestId
    );

    return aiResponse;
  }

  /**
   * Backward compatibility: Old method name
   */
  public async callOllamaApiWithSystemMessage(
    userPrompt: MultimodalContent,
    systemMessage: string,
    options: OllamaRequestOptions = {}
  ): Promise<OllamaResponse | null> {
    return this.callWithSystemMessage(userPrompt, systemMessage, options) as Promise<OllamaResponse | null>;
  }

  /**
   * Backward compatibility: Old method name
   */
  public async callOllamaApi(
    prompt: MultimodalContent,
    options: OllamaRequestOptions = {}
  ): Promise<OllamaResponse | null> {
    return this.call(prompt, options) as Promise<OllamaResponse | null>;
  }
}

// Export singleton instance for backward compatibility
export const ollamaProvider = new OllamaProvider();

// Backward compatibility aliases
export { OllamaProvider as OllamaService };
export { ollamaProvider as ollamaService };
