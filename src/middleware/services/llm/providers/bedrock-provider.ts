import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/utils/logging.utils';
import { BaseLLMProvider } from './base-llm-provider';
import { LLMProvider, CommonLLMResponse, TokenUsage } from '../types';
import {
  BedrockRequestOptions,
  BedrockConverseRequest,
  BedrockConverseResponse,
  BedrockResponse,
  BedrockInferenceConfig
} from '../types/bedrock.types';
import { MultimodalContent, TextContentPart } from '../types/multimodal.types';
import { LLMDebugger, LLMDebugInfo } from '../utils/debug-llm.utils';
import { DataFlowLoggerService } from '../../data-flow-logger';
import { ThinkingExtractorFactory } from '../thinking';
import { retryWithBackoff } from '../utils/retry.utils';
import { hasImages, normalizeContent, contentToDebugString, contentLength } from '../utils/multimodal.utils';
import { BedrockReasoningFactory } from './bedrock-reasoning';

/**
 * AWS Bedrock provider implementation using the Converse API.
 *
 * Why Converse (not InvokeModel): Converse provides a single, model-agnostic
 * request/response shape across Claude, Nova, Llama, Mistral, Qwen, etc. — so
 * switching models is just a different `model` string, no per-model payload code.
 *
 * Why Bearer auth (not AWS SDK / SigV4): Bedrock accepts an API key as a Bearer
 * token directly over REST, mirroring the existing axios-based providers. No
 * heavy @aws-sdk dependency and no request signing required.
 *
 * Auth:   Authorization: Bearer <BEDROCK_API_KEY>
 * Region: BEDROCK_REGION (default eu-central-1 / Frankfurt for EU data residency)
 * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
 */
export class BedrockProvider extends BaseLLMProvider {
  private dataFlowLogger: DataFlowLoggerService;
  private readonly DEFAULT_REGION = 'eu-central-1';
  private readonly DEFAULT_TIMEOUT = 180000;

  constructor() {
    super(LLMProvider.BEDROCK);
    this.dataFlowLogger = DataFlowLoggerService.getInstance();
  }

  /**
   * Build the bedrock-runtime Converse endpoint for a given region and model.
   * The model id is used as-is (model ids such as `qwen.qwen3-32b-v1:0` are
   * valid path segments and must not be percent-encoded).
   */
  private buildEndpoint(region: string, model: string): string {
    return `https://bedrock-runtime.${region}.amazonaws.com/model/${model}/converse`;
  }

  /**
   * Call the AWS Bedrock Converse API with a custom system message.
   * @param userPrompt - The user's prompt (text; image input is a planned follow-up)
   * @param systemMessage - The system message defining AI behavior
   * @param options - Options for the API call
   * @returns The API response or null on error
   */
  public async callWithSystemMessage(
    userPrompt: MultimodalContent,
    systemMessage: string,
    options: BedrockRequestOptions = {}
  ): Promise<CommonLLMResponse | null> {
    const {
      authToken = process.env.BEDROCK_API_KEY,
      model = process.env.BEDROCK_MODEL,
      region = process.env.BEDROCK_REGION || this.DEFAULT_REGION,
      temperature = 0.7,
      maxTokens = 4096,
      topP,
      stopSequences,
      timeout = this.DEFAULT_TIMEOUT,
      debugContext,
      sessionId = uuidv4(),
      chapterNumber,
      pageNumber,
      pageName,
      reasoningEffort
    } = options;

    // Validate that the API key is provided
    if (!authToken) {
      throw new Error(
        'AWS Bedrock API key is required but not provided. ' +
        'Please set BEDROCK_API_KEY in your .env file or pass authToken in options.'
      );
    }

    // Validate that the model is provided
    if (!model) {
      throw new Error(
        'Model name is required but not provided. ' +
        'Please set BEDROCK_MODEL in your .env file or pass model in options.'
      );
    }

    // Bedrock Converse text-block extraction. Image input (Converse image blocks)
    // is a planned follow-up — for now we extract the text parts only.
    if (hasImages(userPrompt)) {
      logger.warn('Image input is not yet supported by the Bedrock provider; using text parts only', {
        context: 'BedrockProvider',
        metadata: { model }
      });
    }
    let userText = typeof userPrompt === 'string'
      ? userPrompt
      : normalizeContent(userPrompt)
          .filter((p): p is TextContentPart => p.type === 'text')
          .map(p => p.text)
          .join('\n');

    // AWS Bedrock Converse caps `inferenceConfig.temperature` and `topP` at 1.0
    // (API-wide, NOT model-specific — the standardized inferenceConfig range is
    // 0.0–1.0). Consumers may pass a Gemini-style range (e.g. temperature 1.3);
    // sending it unclamped triggers a hard HTTP 400, which surfaces to the caller
    // as a null response ("No response received"). Clamp to the valid range + warn.
    const clampUnit = (v: number): number => Math.max(0, Math.min(1, v));
    const clampedTemperature = clampUnit(temperature);
    if (clampedTemperature !== temperature) {
      logger.warn(
        `Bedrock Converse caps temperature at 1.0; clamping ${temperature} → ${clampedTemperature}`,
        { context: 'BedrockProvider', metadata: { model, requestedTemperature: temperature } }
      );
    }
    const clampedTopP = topP !== undefined ? clampUnit(topP) : undefined;
    if (topP !== undefined && clampedTopP !== topP) {
      logger.warn(
        `Bedrock Converse caps topP at 1.0; clamping ${topP} → ${clampedTopP}`,
        { context: 'BedrockProvider', metadata: { model, requestedTopP: topP } }
      );
    }

    // Build Converse inferenceConfig (standardized inference parameters)
    const inferenceConfig: BedrockInferenceConfig = {
      maxTokens,
      temperature: clampedTemperature,
      ...(clampedTopP !== undefined && { topP: clampedTopP }),
      ...(stopSequences && { stopSequences })
    };

    // Apply model-specific reasoning mapping. The consumer always sets the
    // provider-agnostic `reasoningEffort`; the strategy translates it to the
    // right mechanism for this model family (reasoning_effort / reasoningConfig /
    // prompt suffix / no-op) and reports inference-parameter constraints to honor.
    let additionalModelRequestFields: Record<string, unknown> | undefined;
    if (reasoningEffort) {
      const reasoning = BedrockReasoningFactory.forModel(model).apply(reasoningEffort);
      if (reasoning.additionalModelRequestFields) {
        additionalModelRequestFields = { ...reasoning.additionalModelRequestFields };
      }
      if (reasoning.removeInferenceConfigKeys) {
        for (const key of reasoning.removeInferenceConfigKeys) {
          delete inferenceConfig[key];
        }
      }
      if (reasoning.promptSuffix) {
        userText = `${userText}${reasoning.promptSuffix}`;
      }
      (reasoning.warnings ?? []).forEach(w =>
        logger.warn(w, { context: 'BedrockProvider', metadata: { model, reasoningEffort } })
      );
    }

    // Build the Converse request payload
    const requestPayload: BedrockConverseRequest = {
      messages: [
        { role: 'user', content: [{ text: userText }] }
      ],
      // Converse expects `system` as an array of text blocks at the top level
      ...(systemMessage && { system: [{ text: systemMessage }] }),
      inferenceConfig,
      ...(additionalModelRequestFields && { additionalModelRequestFields })
    };

    const endpoint = this.buildEndpoint(region, model);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    // Get client request body from global scope (optional, for richer logs)
    let clientRequestBody: unknown = undefined;
    try {
      clientRequestBody = (global as any).currentRequestBody;
    } catch {
      // Ignore — optional
    }

    // Use debug string to avoid base64 blobs in logs
    const userMessageDebug = contentToDebugString(userPrompt);

    const debugInfo: LLMDebugInfo = {
      timestamp: new Date(),
      provider: this.providerName,
      model,
      baseUrl: endpoint,
      systemMessage,
      userMessage: userMessageDebug,
      requestData: requestPayload,
      useCase: debugContext,
      clientRequestBody,
      sessionId,
      chapterNumber,
      pageNumber,
      pageName,
      temperature,
      reasoningEffort
    };

    await LLMDebugger.logRequest(debugInfo);

    const contextForLogger = {
      currentChapterNr: chapterNumber,
      currentPage: pageNumber,
      debugContext
    };

    const requestId = this.dataFlowLogger.startRequest(debugContext || 'bedrock-converse', contextForLogger);

    this.dataFlowLogger.logLLMRequest(
      {
        stage: debugContext || 'bedrock-converse',
        prompt: userMessageDebug,
        systemMessage,
        modelName: model,
        temperature,
        contextInfo: {
          sessionId,
          chapterNumber,
          pageNumber,
          pageName,
          parameters: { maxTokens, topP, stopSequences, region }
        }
      },
      contextForLogger,
      requestId
    );

    const requestStartTime = Date.now();

    try {
      logger.info('Sending request to AWS Bedrock (Converse)', {
        context: 'BedrockProvider',
        metadata: {
          url: endpoint,
          model,
          region,
          promptLength: contentLength(userPrompt),
          maxTokens
        }
      });

      const response = await retryWithBackoff(
        () => axios.post<BedrockConverseResponse>(
          endpoint,
          requestPayload,
          { headers, timeout }
        ),
        this.constructor.name,
        options.retry
      );

      const requestDuration = Date.now() - requestStartTime;

      if (response && response.status === 200) {
        const apiResponse: BedrockConverseResponse = response.data;
        const blocks = apiResponse.output?.message?.content ?? [];

        // Extract generated text from text blocks
        const rawResponseText = blocks
          .filter(block => block.text !== undefined)
          .map(block => block.text as string)
          .join('\n');

        // Native reasoning text (reasoning-capable models like Qwen3, Claude thinking)
        const nativeReasoning = blocks
          .map(block => block.reasoningContent?.reasoningText?.text)
          .filter((t): t is string => !!t)
          .join('\n');

        // Fall back to tag-based extraction (<think>...) for models that inline
        // their reasoning in the text. Native reasoningContent takes priority.
        const extractor = ThinkingExtractorFactory.forModel(model);
        const { content: responseText, thinking: extractedThinking } = extractor.extract(rawResponseText);
        const thinking = nativeReasoning || extractedThinking;

        // Normalize token usage to the provider-agnostic format
        const tokenUsage: TokenUsage = {
          inputTokens: apiResponse.usage.inputTokens,
          outputTokens: apiResponse.usage.outputTokens,
          totalTokens: apiResponse.usage.totalTokens,
          // Include cache metadata if the model reported cached tokens
          ...((apiResponse.usage.cacheReadInputTokens || apiResponse.usage.cacheWriteInputTokens) ? {
            cacheMetadata: {
              cacheReadTokens: apiResponse.usage.cacheReadInputTokens,
              cacheCreationTokens: apiResponse.usage.cacheWriteInputTokens
            }
          } : {})
        };

        const normalizedResponse: BedrockResponse = {
          message: {
            content: responseText,
            ...(thinking && { thinking })
          },
          sessionId,
          metadata: {
            provider: this.providerName,
            model,
            tokensUsed: tokenUsage.totalTokens,
            processingTime: requestDuration,
            region
          },
          usage: tokenUsage,
          stopReason: apiResponse.stopReason
        };

        debugInfo.responseTimestamp = new Date();
        debugInfo.response = responseText;
        debugInfo.rawResponseData = apiResponse;
        if (thinking) {
          debugInfo.thinking = thinking;
        }

        await LLMDebugger.logResponse(debugInfo);

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'bedrock-converse',
          { rawResponse: responseText, processingTime: requestDuration },
          contextForLogger,
          requestId
        );

        return normalizedResponse;
      } else {
        const error = new Error(`Status ${response?.status || 'unknown'}`);
        logger.error('Error calling AWS Bedrock', {
          context: this.constructor.name,
          error: error.message,
          metadata: response?.data || {}
        });

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'bedrock-converse',
          { rawResponse: '', processingTime: Date.now() - requestStartTime, error },
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

      if (
        error &&
        typeof error === 'object' &&
        'isAxiosError' in error &&
        (error as any).isAxiosError === true
      ) {
        const axiosError = error as any;

        if (axiosError.response) {
          errorDetails = {
            statusCode: axiosError.response.status,
            statusText: axiosError.response.statusText,
            data: axiosError.response.data
          };

          if (axiosError.response.status === 401) {
            logger.error('Authentication error with AWS Bedrock', {
              context: this.constructor.name,
              error: 'Invalid or expired Bedrock API key',
              metadata: { statusCode: 401, message: axiosError.response.data?.message }
            });
          } else if (axiosError.response.status === 403) {
            logger.error('Access denied by AWS Bedrock', {
              context: this.constructor.name,
              error: 'Model access not granted, or model not available in this region',
              metadata: {
                statusCode: 403,
                model,
                region,
                hint: 'Check "Model access" in the Bedrock console for this region.'
              }
            });
          } else if (axiosError.response.status === 429) {
            logger.error('Rate limit / quota exceeded on AWS Bedrock', {
              context: this.constructor.name,
              error: 'Too many requests',
              metadata: { statusCode: 429, retryAfter: axiosError.response.headers?.['retry-after'] }
            });
          } else if (axiosError.response.status === 400) {
            logger.error('Bad request to AWS Bedrock', {
              context: this.constructor.name,
              error: axiosError.response.data?.message || 'Invalid request',
              metadata: { model, details: axiosError.response.data }
            });
          }
        }
      }

      logger.error('Error in Bedrock API request', {
        context: this.constructor.name,
        error: errorMessage,
        metadata: { ...errorDetails, requestModel: model, region, sessionId }
      });

      this.dataFlowLogger.logLLMResponse(
        debugContext || 'bedrock-converse',
        {
          rawResponse: '',
          processingTime: Date.now() - requestStartTime,
          error: error instanceof Error ? error : new Error(errorMessage)
        },
        contextForLogger,
        requestId
      );

      debugInfo.responseTimestamp = new Date();
      debugInfo.error = { message: errorMessage, details: errorDetails };
      await LLMDebugger.logError(debugInfo);

      return null;
    }
  }
}

// Export singleton instance
export const bedrockProvider = new BedrockProvider();

// Export aliases (consistent with other providers)
export { BedrockProvider as BedrockService };
export { bedrockProvider as bedrockService };
