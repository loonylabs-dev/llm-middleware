// NEW FILE: minimax-provider.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/utils/logging.utils';
import { BaseLLMProvider } from './base-llm-provider';
import { LLMProvider, CommonLLMResponse, TokenUsage } from '../types';
import {
  MiniMaxRequestOptions,
  MiniMaxAPIRequest,
  MiniMaxAPIResponse,
  MiniMaxResponse,
  MiniMaxContentPart
} from '../types/minimax.types';
import { MultimodalContent } from '../types/multimodal.types';
import { LLMDebugger, LLMDebugInfo } from '../utils/debug-llm.utils';
import { DataFlowLoggerService } from '../../data-flow-logger';
import { retryWithBackoff } from '../utils/retry.utils';
import { ThinkingExtractorFactory } from '../thinking';
import { normalizeContent, hasImages, contentToDebugString, contentLength } from '../utils/multimodal.utils';

/**
 * MiniMax provider using the OpenAI-compatible Chat Completions API.
 *
 * MiniMax (MiniMax AI, Shanghai) serves its own models — MiniMax-M3 and
 * relatives — on `https://api.minimax.io/v1`. The wire format mirrors the
 * Requesty and Inceptron providers; exactly one behaviour is MiniMax-specific,
 * and it is the reason this provider exists rather than a base-URL override:
 *
 * 🚨 **Reasoning arrives INLINE, as a `<think>…</think>` block inside
 * `message.content`.** There is no `message.reasoning` (Inceptron) and no
 * `reasoningContent` (Bedrock) — `message` carries exactly `content` and
 * `role`. The provider therefore runs the ThinkTag extractor and reports the
 * result as the provider-agnostic `message.thinking`.
 *
 * **The thinking cannot be switched off** (all live-verified against
 * MiniMax-M3):
 *
 *  - `reasoning_effort: 'none'` → HTTP 200, and the `<think>` block is still
 *    there, with MORE reasoning tokens than the call without it (20 vs 12). The
 *    field is not sent.
 *  - `response_format: { type: 'json_object' }` → HTTP 200, and the answer
 *    still arrives wrapped in `<think>`. Not sent either.
 *  - A system message saying "no chain-of-thought" changes nothing. This is a
 *    property of the model, not of the caller.
 *
 * The middleware already records this for the Bedrock path
 * (`bedrock-reasoning.factory.ts`: `noop-minimax`, "always-on interleaved
 * thinking, no toggle"). This provider is the direct-API counterpart, and
 * `ThinkingExtractorFactory.forModel()` now recognises MiniMax so the block is
 * separated instead of leaking into every answer.
 *
 * `usage` is richer than Inceptron's: `reasoning_tokens` is broken out (and is
 * part of `completion_tokens`, not additional), `cached_tokens` appears on
 * cache hits.
 *
 * Auth:      Authorization: Bearer <MINIMAX_API_KEY>
 * Endpoint:  {MINIMAX_BASE_URL}/chat/completions  (default api.minimax.io/v1)
 * @see docs/MINIMAX.md
 */
export class MiniMaxProvider extends BaseLLMProvider {
  private dataFlowLogger: DataFlowLoggerService;
  private readonly DEFAULT_BASE_URL = 'https://api.minimax.io/v1';
  private readonly DEFAULT_MODEL = 'MiniMax-M3';
  /**
   * 300 s, not the 180 s of the other OpenAI-compatible providers.
   *
   * MiniMax always reasons, and the reasoning tokens are generated before the
   * first content token. On a long prompt that pushes time-to-first-answer well
   * past what a non-reasoning model needs; a measured extraction call with a
   * 41,500-character prompt spent a third of its output budget on the `<think>`
   * block. Set, not derived — chosen to match the consumer that prompted this
   * provider rather than measured against a timeout distribution.
   */
  private readonly DEFAULT_TIMEOUT = 300000;

  constructor() {
    super(LLMProvider.MINIMAX);
    this.dataFlowLogger = DataFlowLoggerService.getInstance();
  }

  /**
   * Build the user message content: multimodal (text + image_url) or plain string.
   * Uses the OpenAI image_url/data-URI format, identical to Requesty/Inceptron.
   */
  private buildUserContent(userPrompt: MultimodalContent): string | MiniMaxContentPart[] {
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
   * Call the MiniMax Chat Completions API with a custom system message.
   * @param userPrompt - The user's prompt (text or multimodal content)
   * @param systemMessage - The system message defining AI behavior
   * @param options - Options for the API call
   * @returns The API response or null on error
   */
  public async callWithSystemMessage(
    userPrompt: MultimodalContent,
    systemMessage: string,
    options: MiniMaxRequestOptions = {}
  ): Promise<CommonLLMResponse | null> {
    const {
      authToken = process.env.MINIMAX_API_KEY,
      model = process.env.MINIMAX_MODEL || this.DEFAULT_MODEL,
      baseUrl = process.env.MINIMAX_BASE_URL || this.DEFAULT_BASE_URL,
      temperature = 0.7,
      maxTokens = 4096,
      timeout = this.DEFAULT_TIMEOUT,
      debugContext,
      sessionId = uuidv4(),
      chapterNumber,
      pageNumber,
      pageName,
      reasoningEffort
    } = options;

    if (!authToken) {
      throw new Error(
        'MiniMax API key is required but not provided. ' +
        'Please set MINIMAX_API_KEY in your .env file or pass authToken in options.'
      );
    }

    if (!model) {
      throw new Error(
        'Model name is required but not provided. ' +
        'Please set MINIMAX_MODEL in your .env file or pass model in options.'
      );
    }

    // 🚨 A requested effort is REPORTED, not silently dropped. Live-verified:
    // MiniMax accepts `reasoning_effort` with HTTP 200 and reasons anyway, so
    // honouring the option would be a promise the model does not keep.
    if (reasoningEffort) {
      logger.warn(
        `MiniMax ignores reasoningEffort ('${reasoningEffort}'): thinking is always on and has no toggle. ` +
        'The <think> block is separated out of `content` and returned as `message.thinking`.',
        { context: 'MiniMaxProvider', metadata: { model, reasoningEffort } }
      );
    }

    const base = baseUrl.replace(/\/+$/, '');
    const url = `${base}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };

    const requestPayload: MiniMaxAPIRequest = {
      model,
      messages: [
        ...(systemMessage ? [{ role: 'system' as const, content: systemMessage }] : []),
        { role: 'user' as const, content: this.buildUserContent(userPrompt) }
      ],
      max_tokens: maxTokens,
      temperature
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
      temperature
    };

    await LLMDebugger.logRequest(debugInfo);

    const contextForLogger = {
      currentChapterNr: chapterNumber,
      currentPage: pageNumber,
      debugContext
    };

    const requestId = this.dataFlowLogger.startRequest(debugContext || 'minimax', contextForLogger);

    this.dataFlowLogger.logLLMRequest(
      {
        stage: debugContext || 'minimax',
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
      logger.info('Sending request to MiniMax API', {
        context: 'MiniMaxProvider',
        metadata: {
          url,
          model,
          promptLength: contentLength(userPrompt),
          maxTokens
        }
      });

      const response = await retryWithBackoff(
        () => axios.post<MiniMaxAPIResponse>(
          url,
          requestPayload,
          // Force the Node `http` adapter, for the same reason as the other
          // server-side providers: axios auto-selects its XHR/fetch adapter
          // whenever XMLHttpRequest exists (e.g. under a jsdom test env), and
          // that fails real external HTTPS with a generic ERR_NETWORK.
          { headers, timeout, adapter: 'http' }
        ),
        this.constructor.name,
        options.retry
      );

      const requestDuration = Date.now() - requestStartTime;

      if (response && response.status === 200) {
        const apiResponse: MiniMaxAPIResponse = response.data;
        const choice = apiResponse.choices?.[0];
        const rawContent = choice?.message?.content ?? '';

        // 🚨 The whole point of this provider. MiniMax returns its reasoning
        // inline; without this the `<think>` block is prepended to every
        // answer, and a consumer that quotes from the content quotes the
        // model's working notes.
        const extractor = ThinkingExtractorFactory.forModel(model);
        const { content: responseText, thinking } = extractor.extract(rawContent);

        if (!responseText && thinking) {
          logger.warn(
            'MiniMax returned only a thinking block and no answer. The reasoning consumed the ' +
            'output budget — raise maxTokens.',
            { context: 'MiniMaxProvider', metadata: { model, maxTokens } }
          );
        }

        // Normalize token usage. `reasoning_tokens` is part of
        // `completion_tokens`, not additional to it — it is reported for
        // visibility, not added.
        const usage = apiResponse.usage;
        const cachedTokens = usage?.prompt_tokens_details?.cached_tokens;
        const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens;
        const tokenUsage: TokenUsage = {
          inputTokens: usage?.prompt_tokens ?? 0,
          outputTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
          ...(reasoningTokens ? { reasoningTokens } : {}),
          ...(cachedTokens ? { cacheMetadata: { cacheReadTokens: cachedTokens } } : {})
        };

        const normalizedResponse: MiniMaxResponse = {
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
        if (reasoningTokens) {
          debugInfo.reasoningTokens = reasoningTokens;
        }

        await LLMDebugger.logResponse(debugInfo);

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'minimax',
          { rawResponse: responseText, processingTime: requestDuration },
          contextForLogger,
          requestId
        );

        return normalizedResponse;
      } else {
        const error = new Error(`Status ${response?.status || 'unknown'}`);
        logger.error('Error calling MiniMax API', {
          context: this.constructor.name,
          error: error.message,
          metadata: response?.data || {}
        });

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'minimax',
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
            logger.error('Authentication error with MiniMax API', {
              context: this.constructor.name,
              error: 'Invalid API key (sent as Authorization: Bearer)',
              metadata: { statusCode: 401, message: axiosError.response.data?.error?.message }
            });
          } else if (axiosError.response.status === 402) {
            // MiniMax-specific: 402 separates an empty pay-as-you-go account
            // from a exhausted token plan. Worth naming, because the fix differs.
            logger.error('MiniMax account has no balance or the token plan is exhausted', {
              context: this.constructor.name,
              error: 'Payment required',
              metadata: { statusCode: 402, hint: 'Top up (pay-as-you-go) or check the token plan quota.' }
            });
          } else if (axiosError.response.status === 404) {
            logger.error('MiniMax model or route not found', {
              context: this.constructor.name,
              error: 'Model ID not found, or base URL/route incorrect',
              metadata: {
                statusCode: 404,
                model,
                hint: 'Verify the model ID and MINIMAX_BASE_URL (default https://api.minimax.io/v1).'
              }
            });
          } else if (axiosError.response.status === 429) {
            logger.error('Rate limit exceeded on MiniMax API', {
              context: this.constructor.name,
              error: 'Too many requests',
              metadata: { statusCode: 429, retryAfter: axiosError.response.headers?.['retry-after'] }
            });
          } else if (axiosError.response.status === 400) {
            logger.error('Bad request to MiniMax API', {
              context: this.constructor.name,
              error: axiosError.response.data?.error?.message || 'Invalid request',
              metadata: { model, details: axiosError.response.data?.error }
            });
          }
        }
      }

      logger.error('Error in MiniMax API request', {
        context: this.constructor.name,
        error: errorMessage,
        metadata: { ...errorDetails, requestModel: model, sessionId }
      });

      this.dataFlowLogger.logLLMResponse(
        debugContext || 'minimax',
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
export const miniMaxProvider = new MiniMaxProvider();

// Export aliases (consistent with other providers)
export { MiniMaxProvider as MiniMaxService };
export { miniMaxProvider as miniMaxService };
