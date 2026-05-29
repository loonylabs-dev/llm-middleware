import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/utils/logging.utils';
import { BaseLLMProvider } from './base-llm-provider';
import { LLMProvider, CommonLLMResponse, TokenUsage } from '../types';
import {
  AzureOpenAIRequestOptions,
  AzureOpenAIRequest,
  AzureOpenAIAPIResponse,
  AzureOpenAIResponse,
  AzureOpenAIContentPart
} from '../types/azure-openai.types';
import { MultimodalContent } from '../types/multimodal.types';
import { LLMDebugger, LLMDebugInfo } from '../utils/debug-llm.utils';
import { DataFlowLoggerService } from '../../data-flow-logger';
import { ThinkingExtractorFactory } from '../thinking';
import { retryWithBackoff } from '../utils/retry.utils';
import { normalizeContent, hasImages, contentToDebugString, contentLength } from '../utils/multimodal.utils';
import { isAzureReasoningModel, mapAzureReasoningEffort } from './azure-openai-capabilities';

/**
 * Azure OpenAI / Microsoft Foundry provider using the OpenAI-compatible
 * Chat Completions API (v1 route).
 *
 * Why v1 (not the classic deployments route): the deployment name is sent as the
 * `model` field in the body and `api-version` is optional, which keeps the payload
 * identical to a standard OpenAI request and matches the Requesty provider. The
 * same route serves OpenAI and (increasingly) partner models on Foundry.
 *
 * Why `api-key` header (not Authorization: Bearer): Azure passes the static API
 * key in the `api-key` header; `Authorization: Bearer` is reserved for Microsoft
 * Entra ID tokens (a planned follow-up).
 *
 * Reasoning vs standard models take different parameters (verified live) — see
 * `azure-openai-capabilities.ts`.
 *
 * Auth:     api-key: <AZURE_OPENAI_API_KEY>
 * Endpoint: {AZURE_OPENAI_ENDPOINT}/openai/v1/chat/completions
 * Residency: data zone is chosen at deployment time (EU = Germany West Central / Sweden Central)
 * @see https://learn.microsoft.com/en-us/azure/foundry/openai/latest
 */
export class AzureOpenAIProvider extends BaseLLMProvider {
  private dataFlowLogger: DataFlowLoggerService;
  private readonly DEFAULT_TIMEOUT = 180000;

  constructor() {
    super(LLMProvider.AZURE_OPENAI);
    this.dataFlowLogger = DataFlowLoggerService.getInstance();
  }

  /**
   * Build the Azure OpenAI v1 Chat Completions endpoint.
   * `api-version` is appended only when explicitly provided (the v1 route
   * defaults to no api-version).
   */
  private buildEndpoint(endpoint: string, apiVersion?: string): string {
    const base = endpoint.replace(/\/+$/, '');
    const url = `${base}/openai/v1/chat/completions`;
    return apiVersion ? `${url}?api-version=${encodeURIComponent(apiVersion)}` : url;
  }

  /**
   * Build the user message content: multimodal (text + image_url) or plain string.
   * Uses the OpenAI image_url/data-URI format, identical to the Requesty provider.
   */
  private buildUserContent(userPrompt: MultimodalContent): string | AzureOpenAIContentPart[] {
    if (!hasImages(userPrompt)) {
      return typeof userPrompt === 'string'
        ? userPrompt
        : normalizeContent(userPrompt)
            .map(p => (p as { type: 'text'; text: string }).text)
            .join('\n');
    }
    return normalizeContent(userPrompt).map(part => {
      if (part.type === 'text') {
        return { type: 'text' as const, text: part.text };
      }
      return {
        type: 'image_url' as const,
        image_url: {
          url: `data:${part.mimeType};base64,${part.data}`,
          ...(part.detail && { detail: part.detail })
        }
      };
    });
  }

  /**
   * Call the Azure OpenAI Chat Completions API with a custom system message.
   * @param userPrompt - The user's prompt (text or multimodal content)
   * @param systemMessage - The system message defining AI behavior
   * @param options - Options for the API call
   * @returns The API response or null on error
   */
  public async callWithSystemMessage(
    userPrompt: MultimodalContent,
    systemMessage: string,
    options: AzureOpenAIRequestOptions = {}
  ): Promise<CommonLLMResponse | null> {
    const {
      authToken = process.env.AZURE_OPENAI_API_KEY,
      endpoint = options.baseUrl || process.env.AZURE_OPENAI_ENDPOINT,
      deployment = options.model || process.env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion = process.env.AZURE_OPENAI_API_VERSION || undefined,
      temperature = 0.7,
      maxTokens = 4096,
      topP,
      timeout = this.DEFAULT_TIMEOUT,
      debugContext,
      sessionId = uuidv4(),
      chapterNumber,
      pageNumber,
      pageName,
      reasoningEffort,
      reasoningModel
    } = options;

    // Validate API key
    if (!authToken) {
      throw new Error(
        'Azure OpenAI API key is required but not provided. ' +
        'Please set AZURE_OPENAI_API_KEY in your .env file or pass authToken in options.'
      );
    }

    // Validate endpoint
    if (!endpoint) {
      throw new Error(
        'Azure OpenAI endpoint is required but not provided. ' +
        'Please set AZURE_OPENAI_ENDPOINT in your .env file or pass endpoint in options.'
      );
    }

    // Validate deployment (= model)
    if (!deployment) {
      throw new Error(
        'Azure OpenAI deployment name is required but not provided. ' +
        'Please set AZURE_OPENAI_DEPLOYMENT in your .env file or pass deployment/model in options.'
      );
    }

    const isReasoning = isAzureReasoningModel(deployment, reasoningModel);

    // Build request payload (OpenAI Chat Completions format).
    const requestPayload: AzureOpenAIRequest = {
      model: deployment,
      messages: [
        ...(systemMessage ? [{ role: 'system' as const, content: systemMessage }] : []),
        { role: 'user' as const, content: this.buildUserContent(userPrompt) }
      ]
    };

    // Apply the verified, model-class-specific parameter set.
    if (isReasoning) {
      // Reasoning models: max_completion_tokens, NO temperature/top_p, reasoning_effort.
      requestPayload.max_completion_tokens = maxTokens;
      if (reasoningEffort) {
        const { value, warning } = mapAzureReasoningEffort(reasoningEffort);
        if (value) requestPayload.reasoning_effort = value;
        if (warning) {
          logger.warn(warning, {
            context: 'AzureOpenAIProvider',
            metadata: { deployment, reasoningEffort }
          });
        }
      }
    } else {
      // Standard models: max_tokens + temperature (+ top_p); reasoning_effort is ignored.
      requestPayload.max_tokens = maxTokens;
      requestPayload.temperature = temperature;
      if (topP !== undefined) requestPayload.top_p = topP;
      if (reasoningEffort) {
        logger.warn(
          `reasoningEffort '${reasoningEffort}' is ignored for the non-reasoning Azure model '${deployment}'. ` +
          'Set options.reasoningModel=true if this is actually a reasoning deployment.',
          { context: 'AzureOpenAIProvider', metadata: { deployment } }
        );
      }
    }

    const url = this.buildEndpoint(endpoint, apiVersion);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': authToken
    };

    // Use debug string to avoid base64 blobs in logs
    const userMessageDebug = contentToDebugString(userPrompt);

    const debugInfo: LLMDebugInfo = {
      timestamp: new Date(),
      provider: this.providerName,
      model: deployment,
      baseUrl: url,
      systemMessage,
      userMessage: userMessageDebug,
      requestData: requestPayload,
      useCase: debugContext,
      sessionId,
      chapterNumber,
      pageNumber,
      pageName,
      temperature: isReasoning ? undefined : temperature,
      reasoningEffort
    };

    await LLMDebugger.logRequest(debugInfo);

    const contextForLogger = {
      currentChapterNr: chapterNumber,
      currentPage: pageNumber,
      debugContext
    };

    const requestId = this.dataFlowLogger.startRequest(debugContext || 'azure-openai', contextForLogger);

    this.dataFlowLogger.logLLMRequest(
      {
        stage: debugContext || 'azure-openai',
        prompt: userMessageDebug,
        systemMessage,
        modelName: deployment,
        temperature: isReasoning ? undefined : temperature,
        contextInfo: { sessionId, chapterNumber, pageNumber, pageName }
      },
      contextForLogger,
      requestId
    );

    const requestStartTime = Date.now();

    try {
      logger.info('Sending request to Azure OpenAI', {
        context: 'AzureOpenAIProvider',
        metadata: {
          url,
          deployment,
          isReasoning,
          promptLength: contentLength(userPrompt),
          maxTokens
        }
      });

      const response = await retryWithBackoff(
        () => axios.post<AzureOpenAIAPIResponse>(
          url,
          requestPayload,
          { headers, timeout }
        ),
        this.constructor.name,
        options.retry
      );

      const requestDuration = Date.now() - requestStartTime;

      if (response && response.status === 200) {
        const apiResponse: AzureOpenAIAPIResponse = response.data;

        const rawResponseText = apiResponse.choices[0]?.message?.content || '';

        // Partner models served via Azure may inline reasoning as <think> tags;
        // native OpenAI reasoning text is hidden by Azure (only token counts exposed).
        const extractor = ThinkingExtractorFactory.forModel(deployment);
        const { content: responseText, thinking } = extractor.extract(rawResponseText);

        // Normalize token usage to the provider-agnostic format.
        const usage = apiResponse.usage;
        const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens;
        const cachedTokens = usage.prompt_tokens_details?.cached_tokens;
        const tokenUsage: TokenUsage = {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          ...(reasoningTokens ? { reasoningTokens } : {}),
          ...(cachedTokens ? { cacheMetadata: { cacheReadTokens: cachedTokens } } : {})
        };

        const normalizedResponse: AzureOpenAIResponse = {
          message: {
            content: responseText,
            ...(thinking && { thinking })
          },
          sessionId,
          metadata: {
            provider: this.providerName,
            model: apiResponse.model || deployment,
            tokensUsed: tokenUsage.totalTokens,
            processingTime: requestDuration
          },
          usage: tokenUsage,
          id: apiResponse.id,
          finish_reason: apiResponse.choices[0]?.finish_reason || undefined
        };

        debugInfo.responseTimestamp = new Date();
        debugInfo.response = responseText;
        debugInfo.rawResponseData = apiResponse;
        if (thinking) {
          debugInfo.thinking = thinking;
        }

        await LLMDebugger.logResponse(debugInfo);

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'azure-openai',
          { rawResponse: responseText, processingTime: requestDuration },
          contextForLogger,
          requestId
        );

        return normalizedResponse;
      } else {
        const error = new Error(`Status ${response?.status || 'unknown'}`);
        logger.error('Error calling Azure OpenAI', {
          context: this.constructor.name,
          error: error.message,
          metadata: response?.data || {}
        });

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'azure-openai',
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
            logger.error('Authentication error with Azure OpenAI', {
              context: this.constructor.name,
              error: 'Invalid Azure OpenAI API key (sent in the api-key header)',
              metadata: { statusCode: 401, message: axiosError.response.data?.error?.message }
            });
          } else if (axiosError.response.status === 404) {
            logger.error('Azure OpenAI deployment or route not found', {
              context: this.constructor.name,
              error: 'Deployment name not found, or endpoint/route incorrect',
              metadata: {
                statusCode: 404,
                deployment,
                hint: 'Verify the deployment name and that AZURE_OPENAI_ENDPOINT points at the resource host.'
              }
            });
          } else if (axiosError.response.status === 429) {
            logger.error('Rate limit / quota exceeded on Azure OpenAI', {
              context: this.constructor.name,
              error: 'Too many requests',
              metadata: { statusCode: 429, retryAfter: axiosError.response.headers?.['retry-after'] }
            });
          } else if (axiosError.response.status === 400) {
            logger.error('Bad request to Azure OpenAI', {
              context: this.constructor.name,
              error: axiosError.response.data?.error?.message || 'Invalid request',
              metadata: {
                deployment,
                isReasoning,
                hint: isReasoning
                  ? 'Reasoning models reject temperature/max_tokens; they require max_completion_tokens.'
                  : 'Check parameter compatibility for this deployment.',
                details: axiosError.response.data?.error
              }
            });
          }
        }
      }

      logger.error('Error in Azure OpenAI API request', {
        context: this.constructor.name,
        error: errorMessage,
        metadata: { ...errorDetails, requestDeployment: deployment, sessionId }
      });

      this.dataFlowLogger.logLLMResponse(
        debugContext || 'azure-openai',
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
export const azureOpenAIProvider = new AzureOpenAIProvider();

// Export aliases (consistent with other providers)
export { AzureOpenAIProvider as AzureOpenAIService };
export { azureOpenAIProvider as azureOpenAIService };
