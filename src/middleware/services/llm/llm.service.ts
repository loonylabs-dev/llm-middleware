/**
 * LLM Service Orchestrator
 * Provides a unified interface for interacting with different LLM providers
 */

import { BaseLLMProvider } from './providers/base-llm-provider';
import { OllamaProvider } from './providers/ollama-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { RequestyProvider } from './providers/requesty-provider';
import { VertexAIProvider, VertexAIProviderConfig } from './providers/gemini';
import { BedrockProvider } from './providers/bedrock-provider';
import { AzureOpenAIProvider } from './providers/azure-openai-provider';
import { InceptronProvider } from './providers/inceptron-provider';
import { MiniMaxProvider } from './providers/minimax-provider';
import { LLMProvider, CommonLLMOptions, CommonLLMResponse } from './types';
import { MultimodalContent } from './types/multimodal.types';
import { applyModelSafetyProfile } from './model-safety-profiles';
import { logger } from '../../shared/utils/logging.utils';

export interface LLMServiceOptions {
  /** Configuration for the Vertex AI provider (e.g., region rotation). */
  vertexAIConfig?: VertexAIProviderConfig;
}

export class LLMService {
  private providers: Map<LLMProvider, BaseLLMProvider>;
  private defaultProvider: LLMProvider = LLMProvider.OLLAMA;

  constructor(options?: LLMServiceOptions) {
    this.providers = new Map();
    // Initialize available providers
    this.providers.set(LLMProvider.OLLAMA, new OllamaProvider());
    this.providers.set(LLMProvider.ANTHROPIC, new AnthropicProvider());
    this.providers.set(LLMProvider.GOOGLE, new GeminiProvider());
    this.providers.set(LLMProvider.REQUESTY, new RequestyProvider());
    this.providers.set(LLMProvider.VERTEX_AI, new VertexAIProvider(options?.vertexAIConfig));
    this.providers.set(LLMProvider.BEDROCK, new BedrockProvider());
    this.providers.set(LLMProvider.AZURE_OPENAI, new AzureOpenAIProvider());
    this.providers.set(LLMProvider.INCEPTRON, new InceptronProvider());
    this.providers.set(LLMProvider.MINIMAX, new MiniMaxProvider());
  }

  /**
   * Get a specific provider instance
   */
  public getProvider(provider: LLMProvider): BaseLLMProvider {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} is not available. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    return providerInstance;
  }

  /**
   * Register or replace a provider instance.
   * Use this to reconfigure a provider at runtime (e.g., add region rotation
   * to VertexAI after loading config from database).
   *
   * @param provider - The provider type to register
   * @param instance - The provider instance to use
   *
   * @example
   * ```typescript
   * import { llmService, VertexAIProvider, LLMProvider } from '@loonylabs/llm-middleware';
   *
   * // Replace default Vertex AI provider with region-rotation-enabled one
   * llmService.registerProvider(
   *   LLMProvider.VERTEX_AI,
   *   new VertexAIProvider({ regionRotation: { regions: [...], fallback: 'global' } })
   * );
   * ```
   */
  public registerProvider(provider: LLMProvider, instance: BaseLLMProvider): void {
    this.providers.set(provider, instance);
  }

  /**
   * Set the default provider for all requests
   */
  public setDefaultProvider(provider: LLMProvider): void {
    if (!this.providers.has(provider)) {
      throw new Error(`Provider ${provider} is not available`);
    }
    this.defaultProvider = provider;
  }

  /**
   * Get the current default provider
   */
  public getDefaultProvider(): LLMProvider {
    return this.defaultProvider;
  }

  /**
   * Call an LLM with a custom system message
   * Uses the specified provider or the default provider
   */
  public async callWithSystemMessage(
    userPrompt: MultimodalContent,
    systemMessage: string,
    options: CommonLLMOptions & { provider?: LLMProvider } = {}
  ): Promise<CommonLLMResponse | null> {
    const provider = options.provider || this.defaultProvider;
    const providerInstance = this.getProvider(provider);
    return providerInstance.callWithSystemMessage(userPrompt, systemMessage, this.applySafety(options));
  }

  /**
   * Call an LLM with the default system message
   * Uses the specified provider or the default provider
   */
  public async call(
    prompt: MultimodalContent,
    options: CommonLLMOptions & { provider?: LLMProvider } = {}
  ): Promise<CommonLLMResponse | null> {
    const provider = options.provider || this.defaultProvider;
    const providerInstance = this.getProvider(provider);
    return providerInstance.call(prompt, this.applySafety(options));
  }

  /**
   * Centrally enforce per-model safety envelopes (see model-safety-profiles.ts)
   * for every provider: clamp reasoning_effort up to the model's floor and
   * temperature down to its ceiling, so a fragile model (e.g. GLM-5.1) cannot be
   * driven into degeneration regardless of which consumer / use case called it.
   * Only ever moves values toward the safe envelope; logs whenever it fires.
   */
  private applySafety<T extends CommonLLMOptions & { provider?: LLMProvider }>(options: T): T {
    const safe = applyModelSafetyProfile({
      model: options.model,
      temperature: options.temperature,
      reasoningEffort: options.reasoningEffort,
    });
    if (!safe.clamped.reasoningEffort && !safe.clamped.temperature) {
      return options;
    }
    logger.warn('Applied model safety profile (params clamped to safe envelope)', {
      context: 'LLMService',
      metadata: {
        model: options.model,
        profile: safe.profile?.match,
        reasoningEffort: safe.clamped.reasoningEffort,
        temperature: safe.clamped.temperature,
        note: safe.profile?.note,
      },
    });
    return { ...options, temperature: safe.temperature, reasoningEffort: safe.reasoningEffort };
  }

  /**
   * Get list of available providers
   */
  public getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providers.keys());
  }
}

// Export singleton instance
export const llmService = new LLMService();
