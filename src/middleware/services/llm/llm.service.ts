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
import { LLMProvider, CommonLLMOptions, CommonLLMResponse } from './types';
import { MultimodalContent } from './types/multimodal.types';

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
    return providerInstance.callWithSystemMessage(userPrompt, systemMessage, options);
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
    return providerInstance.call(prompt, options);
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
