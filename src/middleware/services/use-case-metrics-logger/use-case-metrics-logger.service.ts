import { logger } from '../../shared/utils/logging.utils';
import { TokenEstimatorService } from '../token-estimator/token-estimator.service';

/**
 * Metrics collected from a use case execution
 */
export interface UseCaseMetrics {
  executionTimeSeconds: number;
  inputTokenCount: number;
  outputTokenCount: number;
  reasoningTokenCount: number;
  tokensPerSecond: string;
  success: boolean;
  errorMessage?: string;
  modelName: string;
  hasThinking: boolean;
  repeatPenalty?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repeatLastN?: number;
  numPredict?: number;
}

/**
 * Service for logging and tracking use case execution metrics
 * 
 * Tracks performance metrics including:
 * - Execution time
 * - Token usage (input/output)
 * - Generation speed (tokens/sec)
 * - Success/failure status
 * - Model parameters used
 * - Thinking detection
 * 
 * Usage:
 * ```typescript
 * // At start
 * UseCaseMetricsLoggerService.logStart('MyUseCase', 'phi3:mini', 256, 0.7);
 * 
 * // At end
 * const metrics = UseCaseMetricsLoggerService.calculateMetrics(...);
 * UseCaseMetricsLoggerService.logCompletion('MyUseCase', metrics);
 * ```
 */
export class UseCaseMetricsLoggerService {
  
  /**
   * Log the start of a use case execution
   * @param useCaseName Name of the use case
   * @param modelName Name of the model being used
   * @param promptLength Length of the user prompt
   * @param temperature Temperature setting
   * @param additionalParams Additional parameters like repeat_penalty, top_p, etc.
   */
  public static logStart(
    useCaseName: string,
    modelName: string,
    promptLength: number,
    temperature: number,
    additionalParams: { 
      repeatPenalty?: number; 
      topP?: number; 
      topK?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      repeatLastN?: number;
      numPredict?: number;
    } = {}
  ): void {
    logger.info('Starting AI use case execution', {
      context: useCaseName,
      metadata: {
        model: modelName,
        promptLength,
        temperature,
        ...additionalParams
      }
    });
  }

  /**
   * Log the completion of a use case execution
   * @param useCaseName Name of the use case
   * @param metrics Metrics from the execution
   */
  public static logCompletion(useCaseName: string, metrics: UseCaseMetrics): void {
    const statusInfo = metrics.success ? 'SUCCESS' : 'WITH ERRORS';
    const errorInfo = metrics.errorMessage ? ` Error: ${metrics.errorMessage}` : '';
    const executionTimeFormatted = metrics.executionTimeSeconds.toFixed(2);

    const reasoningInfo = metrics.reasoningTokenCount > 0 ? `, Reasoning tokens: ${metrics.reasoningTokenCount}` : '';
    const logMessage = `Completed AI use case [${useCaseName} = ${metrics.modelName}] ${statusInfo} - Time: ${executionTimeFormatted}s, Input tokens: ${metrics.inputTokenCount}, Output tokens: ${metrics.outputTokenCount}${reasoningInfo}, Speed: ${metrics.tokensPerSecond} tokens/sec${errorInfo}`;

    if (metrics.success) {
      logger.info(logMessage, {
        context: useCaseName,
        metadata: {
          ...metrics,
          executionTimeFormatted
        }
      });
    } else {
      logger.error(logMessage, {
        context: useCaseName,
        error: metrics.errorMessage,
        metadata: {
          ...metrics,
          executionTimeFormatted
        }
      });
    }
  }

  /**
   * Calculate metrics from execution data
   * @param startTime Start time of execution (from Date.now())
   * @param systemMessage System message used
   * @param userPrompt User prompt used
   * @param response Response from AI
   * @param thinking Optional thinking content
   * @param modelName Name of the model
   * @param success Whether execution was successful
   * @param errorMessage Optional error message
   * @param additionalParams Additional parameters
   * @param actualTokens Optional actual token counts from provider (preferred over estimation)
   * @returns Calculated metrics
   */
  public static calculateMetrics(
    startTime: number,
    systemMessage: string,
    userPrompt: string,
    response: string,
    thinking: string,
    modelName: string,
    success: boolean,
    errorMessage?: string,
    additionalParams: {
      repeatPenalty?: number;
      topP?: number;
      topK?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      repeatLastN?: number;
      numPredict?: number;
    } = {},
    actualTokens?: {
      inputTokens?: number;
      outputTokens?: number;
      reasoningTokens?: number;
    }
  ): UseCaseMetrics {
    const executionTimeSeconds = (Date.now() - startTime) / 1000;

    // Use actual token counts from provider if available, otherwise estimate
    let inputTokenCount: number;
    let outputTokenCount: number;
    let reasoningTokenCount: number;

    if (actualTokens?.inputTokens !== undefined && actualTokens?.outputTokens !== undefined) {
      // Use actual token counts from provider (accurate)
      inputTokenCount = actualTokens.inputTokens;
      outputTokenCount = actualTokens.outputTokens;
      reasoningTokenCount = actualTokens.reasoningTokens ?? 0;
    } else {
      // Fallback: Estimate token counts using TokenEstimatorService
      const inputEstimate = TokenEstimatorService.estimateInputTokens(systemMessage, userPrompt);
      const outputEstimate = TokenEstimatorService.estimateTokenCount(response);

      inputTokenCount = inputEstimate.estimated;
      outputTokenCount = outputEstimate.estimated;
      reasoningTokenCount = 0;
    }

    // Speed includes reasoning tokens — they represent real model work time
    const tokensPerSecond = TokenEstimatorService.calculateTokensPerSecond(
      outputTokenCount + reasoningTokenCount,
      executionTimeSeconds
    );

    return {
      executionTimeSeconds,
      inputTokenCount,
      outputTokenCount,
      reasoningTokenCount,
      tokensPerSecond,
      success,
      errorMessage,
      modelName,
      hasThinking: !!thinking,
      ...additionalParams
    };
  }
}
