import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/utils/logging.utils';
import { BaseLLMProvider } from './base-llm-provider';
import { LLMProvider, CommonLLMResponse, TokenUsage } from '../types';
import {
  GeminiRequestOptions,
  GeminiAPIRequest,
  GeminiAPIResponse,
  GeminiResponse,
  GeminiGenerationConfig
} from '../types/gemini.types';
import { LLMDebugger, LLMDebugInfo } from '../utils/debug-llm.utils';
import { DataFlowLoggerService } from '../../data-flow-logger';

/**
 * Google Gemini provider implementation with advanced features:
 * - Comprehensive debugging and logging
 * - Error handling with retry logic
 * - Session management
 * - Parameter handling
 */
export class GeminiProvider extends BaseLLMProvider {
  private dataFlowLogger: DataFlowLoggerService;
  private readonly BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    super(LLMProvider.GOOGLE);
    this.dataFlowLogger = DataFlowLoggerService.getInstance();
  }

  /**
   * Call the Google Gemini API with a custom system message
   * @param userPrompt - The user's prompt for the model
   * @param systemMessage - The system message defining AI behavior
   * @param options - Options for the API call
   * @returns The API response or null on error
   */
  public async callWithSystemMessage(
    userPrompt: string,
    systemMessage: string,
    options: GeminiRequestOptions = {}
  ): Promise<CommonLLMResponse | null> {
    const {
      authToken = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      model = process.env.GEMINI_MODEL || 'gemini-1.5-pro',
      temperature = 0.7,
      maxTokens,
      maxOutputTokens = maxTokens || 4096,
      topP,
      topK,
      stopSequences,
      candidateCount = 1,
      debugContext,
      sessionId = uuidv4(),
      chapterNumber,
      pageNumber,
      pageName
    } = options;

    // Validate that API key is provided
    if (!authToken) {
      throw new Error(
        'Google Gemini API key is required but not provided. ' +
        'Please set GEMINI_API_KEY or GOOGLE_API_KEY in your .env file or pass authToken in options.'
      );
    }

    // Validate that model is provided
    if (!model) {
      throw new Error(
        'Model name is required but not provided. ' +
        'Please set GEMINI_MODEL in your .env file or pass model in options.'
      );
    }

    // Build generation config
    const generationConfig: GeminiGenerationConfig = {
      temperature: temperature,
      maxOutputTokens: maxOutputTokens,
      ...(topP !== undefined && { topP }),
      ...(topK !== undefined && { topK }),
      ...(stopSequences && { stopSequences }),
      ...(candidateCount !== undefined && { candidateCount })
    };

    // Build the request payload
    const requestPayload: GeminiAPIRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: generationConfig,
      systemInstruction: {
        parts: [{ text: systemMessage }]
      }
    };

    // Get client request body from global scope
    let clientRequestBody: any = undefined;
    try {
      clientRequestBody = (global as any).currentRequestBody;
    } catch (error) {
      // Ignore as it's optional
    }

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

    const requestId = this.dataFlowLogger.startRequest(debugContext || 'gemini-direct', contextForLogger);

    this.dataFlowLogger.logLLMRequest(
      {
        stage: debugContext || 'gemini-direct',
        prompt: userPrompt,
        systemMessage: systemMessage,
        modelName: model,
        temperature: temperature,
        contextInfo: {
          sessionId,
          chapterNumber,
          pageNumber,
          pageName,
          parameters: {
            maxOutputTokens,
            topP,
            topK,
            stopSequences,
            candidateCount
          }
        }
      },
      contextForLogger,
      requestId
    );

    const requestStartTime = Date.now();

    try {
      // Construct the API endpoint URL
      const endpoint = `${this.BASE_URL}/models/${model}:generateContent`;
      
      logger.info('Sending request to Google Gemini API', {
        context: 'GeminiProvider',
        metadata: {
          url: endpoint,
          model: model,
          promptLength: userPrompt.length,
          maxOutputTokens: maxOutputTokens
        }
      });

      const response = await axios.post<GeminiAPIResponse>(
        endpoint,
        requestPayload,
        {
          params: {
            key: authToken
          },
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 180000 // 180 second timeout
        }
      );

      const requestDuration = Date.now() - requestStartTime;

      if (response && response.status === 200) {
        const apiResponse: GeminiAPIResponse = response.data;

        // Check if we have candidates
        if (!apiResponse.candidates || apiResponse.candidates.length === 0) {
          throw new Error('No candidates returned from Gemini API');
        }

        // Get the first candidate's content
        const candidate = apiResponse.candidates[0];
        const responseText = candidate.content.parts
          .map(part => part.text)
          .join('\n');

        // Normalize token usage to provider-agnostic format
        const tokenUsage: TokenUsage | undefined = apiResponse.usageMetadata
          ? {
              inputTokens: apiResponse.usageMetadata.promptTokenCount,
              outputTokens: apiResponse.usageMetadata.candidatesTokenCount,
              totalTokens: apiResponse.usageMetadata.totalTokenCount
            }
          : undefined;

        // Build normalized response
        const normalizedResponse: CommonLLMResponse = {
          message: {
            content: responseText
          },
          sessionId: sessionId,
          metadata: {
            provider: this.providerName,
            model: model,
            tokensUsed: tokenUsage?.totalTokens,
            processingTime: requestDuration
          },
          usage: tokenUsage
        };

        logger.info('Successfully received response from Gemini API', {
          context: 'GeminiProvider',
          metadata: {
            model: model,
            responseLength: responseText.length,
            tokensUsed: tokenUsage?.totalTokens,
            processingTime: requestDuration,
            finishReason: candidate.finishReason
          }
        });

        // Update debug info with response
        debugInfo.response = responseText;
        debugInfo.responseTimestamp = new Date();
        debugInfo.rawResponseData = apiResponse;
        await LLMDebugger.logResponse(debugInfo);

        // Log to data flow logger
        this.dataFlowLogger.logLLMResponse(
          debugContext || 'gemini-direct',
          {
            rawResponse: responseText,
            processingTime: requestDuration
          },
          contextForLogger,
          requestId
        );

        return normalizedResponse;
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
    } catch (error: any) {
      const requestDuration = Date.now() - requestStartTime;

      logger.error('Error calling Gemini API', {
        context: 'GeminiProvider',
        metadata: {
          error: error.message,
          model: model,
          processingTime: requestDuration,
          errorDetails: error.response?.data
        }
      });

      // Update debug info with error
      debugInfo.error = {
        message: error.message,
        details: error.response?.data || error
      };
      debugInfo.responseTimestamp = new Date();
      await LLMDebugger.logResponse(debugInfo);

      // Log error to data flow logger
      this.dataFlowLogger.logLLMResponse(
        debugContext || 'gemini-direct',
        {
          rawResponse: '',
          processingTime: requestDuration,
          error: error
        },
        contextForLogger,
        requestId
      );

      throw error;
    }
  }
}

// Export singleton instance
export const geminiProvider = new GeminiProvider();
