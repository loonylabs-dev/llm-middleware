// NEW FILE: inceptron-provider.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/utils/logging.utils';
import { BaseLLMProvider } from './base-llm-provider';
import { LLMProvider, CommonLLMResponse, TokenUsage, ReasoningEffort } from '../types';
import {
  InceptronRequestOptions,
  InceptronAPIRequest,
  InceptronAPIResponse,
  InceptronResponse,
  InceptronContentPart
} from '../types/inceptron.types';
import { MultimodalContent } from '../types/multimodal.types';
import { LLMDebugger, LLMDebugInfo } from '../utils/debug-llm.utils';
import { DataFlowLoggerService } from '../../data-flow-logger';
import { retryWithBackoff } from '../utils/retry.utils';
import { normalizeContent, hasImages, contentToDebugString, contentLength } from '../utils/multimodal.utils';

/**
 * Default reasoning effort sent when the caller does not specify one.
 *
 * Live verification against zai-org/GLM-5.1-FP8 showed that omitting
 * reasoning_effort makes `content` non-deterministic (sometimes empty, with the
 * whole answer in `reasoning`). Sending an explicit value — even 'none' —
 * reliably populates `content`. 'none' is chosen as the safe default: clean,
 * fast, deterministic content with no reasoning-token overhead. Callers opt into
 * reasoning explicitly via `reasoningEffort`.
 */
const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'none';

/**
 * Inceptron provider using the OpenAI-compatible Chat Completions API.
 *
 * Inceptron (Inceptron AB, Lund/Sweden) serves curated open-weight models
 * (GLM-5.1, Kimi, DeepSeek, gpt-oss, MiniMax, Llama, …) on a compiler-accelerated
 * inference stack. The wire format mirrors the Requesty provider — only two
 * behaviours are Inceptron-specific (both live-verified):
 *
 *  1. Reasoning text arrives in `message.reasoning` (OpenRouter style), which we
 *     map to the provider-agnostic `message.thinking`.
 *  2. `message.content` can be `null`; we treat it as an empty string and warn
 *     when it is empty while reasoning is present.
 *
 * `usage` carries no `reasoning_tokens` (reasoning is folded into
 * `completion_tokens`, like Ollama) and no `cost`.
 *
 * Auth:      Authorization: Bearer <INCEPTRON_API_KEY>
 * Endpoint:  {INCEPTRON_BASE_URL}/chat/completions  (default openrouter.inceptron.io/v1)
 * Residency: per-model — e.g. GLM-5.1 is marked EU-resident. DPA/SCCs on request.
 * @see docs/INCEPTRON.md
 */
export class InceptronProvider extends BaseLLMProvider {
  private dataFlowLogger: DataFlowLoggerService;
  private readonly DEFAULT_BASE_URL = 'https://openrouter.inceptron.io/v1';
  private readonly DEFAULT_MODEL = 'zai-org/GLM-5.1-FP8';
  private readonly DEFAULT_TIMEOUT = 180000;

  constructor() {
    super(LLMProvider.INCEPTRON);
    this.dataFlowLogger = DataFlowLoggerService.getInstance();
  }

  /**
   * Build the user message content: multimodal (text + image_url) or plain string.
   * Uses the OpenAI image_url/data-URI format, identical to Requesty/Azure.
   */
  private buildUserContent(userPrompt: MultimodalContent): string | InceptronContentPart[] {
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
   * Call the Inceptron Chat Completions API with a custom system message.
   * @param userPrompt - The user's prompt (text or multimodal content)
   * @param systemMessage - The system message defining AI behavior
   * @param options - Options for the API call
   * @returns The API response or null on error
   */
  public async callWithSystemMessage(
    userPrompt: MultimodalContent,
    systemMessage: string,
    options: InceptronRequestOptions = {}
  ): Promise<CommonLLMResponse | null> {
    const {
      authToken = process.env.INCEPTRON_API_KEY,
      model = process.env.INCEPTRON_MODEL || this.DEFAULT_MODEL,
      baseUrl = process.env.INCEPTRON_BASE_URL || this.DEFAULT_BASE_URL,
      temperature = 0.7,
      maxTokens = 4096,
      timeout = this.DEFAULT_TIMEOUT,
      httpReferer,
      xTitle,
      debugContext,
      sessionId = uuidv4(),
      chapterNumber,
      pageNumber,
      pageName,
      reasoningEffort
    } = options;

    // Validate API key
    if (!authToken) {
      throw new Error(
        'Inceptron API key is required but not provided. ' +
        'Please set INCEPTRON_API_KEY in your .env file or pass authToken in options.'
      );
    }

    // Validate model
    if (!model) {
      throw new Error(
        'Model name is required but not provided. ' +
        'Please set INCEPTRON_MODEL in your .env file or pass model in options.'
      );
    }

    // Always send a reasoning_effort to keep `content` deterministic (see DEFAULT_REASONING_EFFORT).
    const effectiveEffort = reasoningEffort ?? DEFAULT_REASONING_EFFORT;

    const base = baseUrl.replace(/\/+$/, '');
    const url = `${base}/chat/completions`;

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
    if (httpReferer) headers['HTTP-Referer'] = httpReferer;
    if (xTitle) headers['X-Title'] = xTitle;

    // Build request payload (OpenAI format)
    const requestPayload: InceptronAPIRequest = {
      model,
      messages: [
        ...(systemMessage ? [{ role: 'system' as const, content: systemMessage }] : []),
        { role: 'user' as const, content: this.buildUserContent(userPrompt) }
      ],
      max_tokens: maxTokens,
      temperature,
      reasoning_effort: effectiveEffort
    };

    // Use debug string to avoid base64 blobs in logs
    const userMessageDebug = contentToDebugString(userPrompt);

    const debugInfo: LLMDebugInfo = {
      timestamp: new Date(),
      provider: this.providerName,
      model,
      baseUrl: url,
      systemMessage,
      userMessage: userMessageDebug,
      requestData: requestPayload,
      useCase: debugContext,
      sessionId,
      chapterNumber,
      pageNumber,
      pageName,
      temperature,
      reasoningEffort: effectiveEffort
    };

    await LLMDebugger.logRequest(debugInfo);

    const contextForLogger = {
      currentChapterNr: chapterNumber,
      currentPage: pageNumber,
      debugContext
    };

    const requestId = this.dataFlowLogger.startRequest(debugContext || 'inceptron', contextForLogger);

    this.dataFlowLogger.logLLMRequest(
      {
        stage: debugContext || 'inceptron',
        prompt: userMessageDebug,
        systemMessage,
        modelName: model,
        temperature,
        contextInfo: { sessionId, chapterNumber, pageNumber, pageName }
      },
      contextForLogger,
      requestId
    );

    const requestStartTime = Date.now();

    try {
      logger.info('Sending request to Inceptron API', {
        context: 'InceptronProvider',
        metadata: {
          url,
          model,
          reasoningEffort: effectiveEffort,
          promptLength: contentLength(userPrompt),
          maxTokens
        }
      });

      const response = await retryWithBackoff(
        () => axios.post<InceptronAPIResponse>(
          url,
          requestPayload,
          { headers, timeout }
        ),
        this.constructor.name,
        options.retry
      );

      const requestDuration = Date.now() - requestStartTime;

      if (response && response.status === 200) {
        const apiResponse: InceptronAPIResponse = response.data;
        const choice = apiResponse.choices[0];

        // `content` can be null (see InceptronAPIResponse); treat as empty string.
        const responseText = choice?.message?.content ?? '';
        // Reasoning arrives in `message.reasoning` (OpenRouter style) -> map to thinking.
        const thinking = choice?.message?.reasoning || undefined;

        // GLM-5.1 occasionally returns empty content with all text in `reasoning`.
        // Surface it so the consumer understands an empty answer, rather than silently
        // returning "". (Does not happen with the default reasoning_effort='none'.)
        if (!responseText && thinking) {
          logger.warn(
            'Inceptron returned empty content while reasoning text was present. ' +
            'The model kept its answer in the reasoning channel. ' +
            "Consider setting reasoningEffort='none' or raising maxTokens.",
            { context: 'InceptronProvider', metadata: { model, reasoningEffort: effectiveEffort } }
          );
        }

        // Normalize token usage. No reasoning_tokens / cost are returned; reasoning
        // is folded into completion_tokens (like Ollama). cached_tokens may appear
        // on cache hits.
        const usage = apiResponse.usage;
        const cachedTokens = usage?.prompt_tokens_details?.cached_tokens;
        const tokenUsage: TokenUsage = {
          inputTokens: usage?.prompt_tokens ?? 0,
          outputTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
          ...(cachedTokens ? { cacheMetadata: { cacheReadTokens: cachedTokens } } : {})
        };

        const normalizedResponse: InceptronResponse = {
          message: {
            content: responseText,
            ...(thinking && { thinking })
          },
          sessionId,
          metadata: {
            provider: this.providerName,
            model: apiResponse.model || model,
            tokensUsed: tokenUsage.totalTokens,
            processingTime: requestDuration
          },
          usage: tokenUsage,
          id: apiResponse.id,
          finish_reason: choice?.finish_reason || undefined
        };

        debugInfo.responseTimestamp = new Date();
        debugInfo.response = responseText;
        debugInfo.rawResponseData = apiResponse;
        if (thinking) {
          debugInfo.thinking = thinking;
        }

        await LLMDebugger.logResponse(debugInfo);

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'inceptron',
          { rawResponse: responseText, processingTime: requestDuration },
          contextForLogger,
          requestId
        );

        return normalizedResponse;
      } else {
        const error = new Error(`Status ${response?.status || 'unknown'}`);
        logger.error('Error calling Inceptron API', {
          context: this.constructor.name,
          error: error.message,
          metadata: response?.data || {}
        });

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'inceptron',
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

      // Handle Axios errors
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
            logger.error('Authentication error with Inceptron API', {
              context: this.constructor.name,
              error: 'Invalid API key (sent as Authorization: Bearer)',
              metadata: { statusCode: 401, message: axiosError.response.data?.error?.message }
            });
          } else if (axiosError.response.status === 404) {
            logger.error('Inceptron model or route not found', {
              context: this.constructor.name,
              error: 'Model ID not found, or base URL/route incorrect',
              metadata: {
                statusCode: 404,
                model,
                hint: 'Verify the model ID and INCEPTRON_BASE_URL (dashboard quickstart shows openrouter.inceptron.io/v1).'
              }
            });
          } else if (axiosError.response.status === 429) {
            logger.error('Rate limit exceeded on Inceptron API', {
              context: this.constructor.name,
              error: 'Too many requests',
              metadata: { statusCode: 429, retryAfter: axiosError.response.headers?.['retry-after'] }
            });
          } else if (axiosError.response.status === 400) {
            logger.error('Bad request to Inceptron API', {
              context: this.constructor.name,
              error: axiosError.response.data?.error?.message || 'Invalid request',
              metadata: { model, details: axiosError.response.data?.error }
            });
          }
        }
      }

      logger.error('Error in Inceptron API request', {
        context: this.constructor.name,
        error: errorMessage,
        metadata: { ...errorDetails, requestModel: model, sessionId }
      });

      this.dataFlowLogger.logLLMResponse(
        debugContext || 'inceptron',
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
export const inceptronProvider = new InceptronProvider();

// Export aliases (consistent with other providers)
export { InceptronProvider as InceptronService };
export { inceptronProvider as inceptronService };
