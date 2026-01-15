/**
 * Abstract base class for Gemini-based providers (Direct API and Vertex AI)
 * Contains shared logic for request building, response parsing, and reasoning mapping.
 */

import axios, { AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../../shared/utils/logging.utils';
import { BaseLLMProvider } from '../base-llm-provider';
import { LLMProvider, CommonLLMResponse, TokenUsage, ReasoningEffort } from '../../types';
import {
  GeminiRequestOptions,
  GeminiAPIRequest,
  GeminiAPIResponse,
  GeminiGenerationConfig,
  GeminiThinkingLevel
} from '../../types/gemini.types';
import { LLMDebugger, LLMDebugInfo } from '../../utils/debug-llm.utils';
import { DataFlowLoggerService } from '../../../data-flow-logger';

/**
 * Gemini model generation - determines which reasoning API to use.
 * - Gemini 2.5: Uses thinkingBudget (integer 0-24576)
 * - Gemini 3.x: Uses thinkingLevel (MINIMAL/LOW/MEDIUM/HIGH)
 */
export type GeminiGeneration = '2.5' | '3';

/**
 * Detects the Gemini generation from model name.
 * @param model - Model name (e.g., 'gemini-2.5-flash', 'gemini-3-flash-preview')
 * @returns The detected generation or undefined if not a reasoning model
 */
export function detectGeminiGeneration(model: string): GeminiGeneration | undefined {
  const lowerModel = model.toLowerCase();

  if (lowerModel.includes('gemini-3') || lowerModel.includes('gemini-3.')) {
    return '3';
  }
  if (lowerModel.includes('gemini-2.5') || lowerModel.includes('gemini-2.5.')) {
    return '2.5';
  }
  // Gemini 1.5, 2.0 etc. don't support reasoning
  return undefined;
}

/**
 * Maps provider-agnostic ReasoningEffort to Gemini 3.x thinking_level.
 */
export function mapReasoningEffortToThinkingLevel(effort: ReasoningEffort): GeminiThinkingLevel {
  switch (effort) {
    case 'none':
      return 'MINIMAL';  // Gemini 3 doesn't support disabling, use MINIMAL
    case 'low':
      return 'LOW';
    case 'medium':
      return 'MEDIUM';
    case 'high':
      return 'HIGH';
    default:
      return 'MEDIUM';  // Safe default
  }
}

/**
 * Maps provider-agnostic ReasoningEffort to Gemini 2.5 thinking_budget.
 * @returns Token budget (0 = disabled, -1 = dynamic)
 *
 * Budget values:
 * - 0: Disabled
 * - 1024: Low (minimum for active thinking)
 * - 6144: Medium
 * - 12288: High
 */
export function mapReasoningEffortToThinkingBudget(effort: ReasoningEffort): number {
  switch (effort) {
    case 'none':
      return 0;  // Disable thinking
    case 'low':
      return 1024;
    case 'medium':
      return 6144;
    case 'high':
      return 12288;
    default:
      return -1;  // Dynamic (let model decide)
  }
}

/**
 * Extended options for Gemini providers with generation hint.
 */
export interface GeminiProviderOptions extends GeminiRequestOptions {
  /** Override automatic generation detection */
  geminiGeneration?: GeminiGeneration;
}

/**
 * Abstract base class for all Gemini-based providers.
 * Subclasses must implement:
 * - getBaseUrl(): Returns the API base URL
 * - getAuthConfig(): Returns axios auth configuration
 */
export abstract class GeminiBaseProvider extends BaseLLMProvider {
  protected dataFlowLogger: DataFlowLoggerService;

  constructor(providerName: LLMProvider) {
    super(providerName);
    this.dataFlowLogger = DataFlowLoggerService.getInstance();
  }

  /**
   * Get the base URL for API requests.
   * @param model - The model name (may be needed for Vertex AI regional endpoints)
   * @param options - Provider options (may contain region info)
   */
  protected abstract getBaseUrl(model: string, options: GeminiProviderOptions): string;

  /**
   * Get the authentication configuration for axios requests.
   * @param options - Provider options containing auth info
   * @returns Axios request config with auth headers/params
   */
  protected abstract getAuthConfig(options: GeminiProviderOptions): Promise<AxiosRequestConfig>;

  /**
   * Get the full endpoint URL for generateContent.
   * @param model - The model name
   * @param options - Provider options
   */
  protected abstract getEndpointUrl(model: string, options: GeminiProviderOptions): string;

  /**
   * Build the generation config including reasoning parameters.
   */
  protected buildGenerationConfig(
    options: GeminiProviderOptions,
    model: string
  ): GeminiGenerationConfig {
    const {
      temperature = 0.7,
      maxTokens,
      maxOutputTokens = maxTokens || 4096,
      topP,
      topK,
      stopSequences,
      candidateCount = 1,
      reasoningEffort,
      geminiGeneration
    } = options;

    const config: GeminiGenerationConfig = {
      temperature,
      maxOutputTokens,
      ...(topP !== undefined && { topP }),
      ...(topK !== undefined && { topK }),
      ...(stopSequences && { stopSequences }),
      ...(candidateCount !== undefined && { candidateCount }),
    };

    // Add reasoning config if reasoningEffort is specified
    if (reasoningEffort) {
      const generation = geminiGeneration || detectGeminiGeneration(model);

      if (generation === '3') {
        // Gemini 3.x uses thinkingLevel
        if (reasoningEffort === 'none') {
          config.thinkingConfig = {
            thinkingLevel: 'MINIMAL'  // Gemini 3 cannot fully disable, use MINIMAL
          };
        } else {
          config.thinkingConfig = {
            thinkingLevel: mapReasoningEffortToThinkingLevel(reasoningEffort),
            includeThoughts: true
          };
        }
      } else if (generation === '2.5') {
        // Gemini 2.5 uses thinkingBudget
        // - thinkingBudget: 0 disables thinking (must NOT include includeThoughts: true)
        // - thinkingBudget > 0 enables thinking (includeThoughts: true to get token counts)
        // - Omitting thinkingConfig entirely → Dynamic mode (up to 8192 tokens)
        if (reasoningEffort === 'none') {
          config.thinkingConfig = {
            thinkingBudget: 0
            // Do NOT set includeThoughts when budget is 0 (causes validation error)
          };
        } else {
          config.thinkingConfig = {
            thinkingBudget: mapReasoningEffortToThinkingBudget(reasoningEffort),
            includeThoughts: true
          };
        }
      }
      // For other generations (1.5, 2.0), no thinking config is added
    }
    // When reasoningEffort is undefined, we don't add thinkingConfig
    // This enables Dynamic Thinking mode (model decides, up to ~8192 tokens)

    return config;
  }

  /**
   * Build the API request payload.
   */
  protected buildRequestPayload(
    userPrompt: string,
    systemMessage: string,
    generationConfig: GeminiGenerationConfig
  ): GeminiAPIRequest {
    return {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig,
      systemInstruction: {
        parts: [{ text: systemMessage }]
      }
    };
  }

  /**
   * Parse the API response into normalized format.
   */
  protected parseResponse(
    apiResponse: GeminiAPIResponse,
    sessionId: string,
    model: string,
    requestDuration: number
  ): CommonLLMResponse {
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
          totalTokens: apiResponse.usageMetadata.totalTokenCount,
          // Gemini 2.5+/3+ returns thoughtsTokenCount for reasoning tokens
          ...(apiResponse.usageMetadata.thoughtsTokenCount !== undefined && {
            reasoningTokens: apiResponse.usageMetadata.thoughtsTokenCount
          })
        }
      : undefined;

    return {
      message: {
        content: responseText
      },
      sessionId,
      metadata: {
        provider: this.providerName,
        model,
        tokensUsed: tokenUsage?.totalTokens,
        processingTime: requestDuration
      },
      usage: tokenUsage
    };
  }

  /**
   * Call the Gemini API with a custom system message.
   * This is the main entry point - uses template method pattern.
   */
  public async callWithSystemMessage(
    userPrompt: string,
    systemMessage: string,
    options: GeminiProviderOptions = {}
  ): Promise<CommonLLMResponse | null> {
    const {
      model = this.getDefaultModel(),
      debugContext,
      sessionId = uuidv4(),
      chapterNumber,
      pageNumber,
      pageName,
    } = options;

    // Validate model
    if (!model) {
      throw new Error(
        'Model name is required but not provided. ' +
        'Please set the appropriate environment variable or pass model in options.'
      );
    }

    // Build generation config
    const generationConfig = this.buildGenerationConfig(options, model);

    // Build request payload
    const requestPayload = this.buildRequestPayload(userPrompt, systemMessage, generationConfig);

    // Get endpoint URL
    const endpoint = this.getEndpointUrl(model, options);

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
      model,
      baseUrl: this.getBaseUrl(model, options),
      systemMessage,
      userMessage: userPrompt,
      requestData: requestPayload,
      useCase: debugContext,
      clientRequestBody,
      sessionId,
      chapterNumber,
      pageNumber,
      pageName
    };

    // Log request
    await LLMDebugger.logRequest(debugInfo);

    // Log to data flow logger
    const contextForLogger = {
      currentChapterNr: chapterNumber,
      currentPage: pageNumber,
      debugContext
    };

    const requestId = this.dataFlowLogger.startRequest(debugContext || this.providerName, contextForLogger);

    this.dataFlowLogger.logLLMRequest(
      {
        stage: debugContext || this.providerName,
        prompt: userPrompt,
        systemMessage,
        modelName: model,
        temperature: generationConfig.temperature,
        contextInfo: {
          sessionId,
          chapterNumber,
          pageNumber,
          pageName,
          parameters: {
            maxOutputTokens: generationConfig.maxOutputTokens,
            topP: generationConfig.topP,
            topK: generationConfig.topK,
            stopSequences: generationConfig.stopSequences,
            candidateCount: generationConfig.candidateCount
          }
        }
      },
      contextForLogger,
      requestId
    );

    const requestStartTime = Date.now();

    try {
      // Get auth config (implemented by subclasses)
      const authConfig = await this.getAuthConfig(options);

      logger.info(`Sending request to ${this.providerName} API`, {
        context: this.constructor.name,
        metadata: {
          url: endpoint,
          model,
          promptLength: userPrompt.length,
          maxOutputTokens: generationConfig.maxOutputTokens
        }
      });

      const response = await axios.post<GeminiAPIResponse>(
        endpoint,
        requestPayload,
        {
          ...authConfig,
          headers: {
            'Content-Type': 'application/json',
            ...authConfig.headers
          },
          timeout: 180000 // 180 second timeout
        }
      );

      const requestDuration = Date.now() - requestStartTime;

      if (response && response.status === 200) {
        const normalizedResponse = this.parseResponse(
          response.data,
          sessionId,
          model,
          requestDuration
        );

        logger.info(`Successfully received response from ${this.providerName} API`, {
          context: this.constructor.name,
          metadata: {
            model,
            responseLength: normalizedResponse.message.content.length,
            tokensUsed: normalizedResponse.usage?.totalTokens,
            reasoningTokens: normalizedResponse.usage?.reasoningTokens,
            processingTime: requestDuration,
            finishReason: response.data.candidates?.[0]?.finishReason
          }
        });

        // Update debug info with response
        debugInfo.response = normalizedResponse.message.content;
        debugInfo.responseTimestamp = new Date();
        debugInfo.rawResponseData = response.data;
        await LLMDebugger.logResponse(debugInfo);

        // Log to data flow logger
        this.dataFlowLogger.logLLMResponse(
          debugContext || this.providerName,
          {
            rawResponse: normalizedResponse.message.content,
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

      logger.error(`Error calling ${this.providerName} API`, {
        context: this.constructor.name,
        metadata: {
          error: error.message,
          model,
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
        debugContext || this.providerName,
        {
          rawResponse: '',
          processingTime: requestDuration,
          error
        },
        contextForLogger,
        requestId
      );

      throw error;
    }
  }

  /**
   * Get the default model for this provider.
   * Subclasses should override to provide appropriate defaults.
   */
  protected abstract getDefaultModel(): string;
}
