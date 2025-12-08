/**
 * LLM Service Orchestrator
 * Provides a unified interface for interacting with different LLM providers
 */

import { BaseLLMProvider } from './providers/base-llm-provider';
import { OllamaProvider } from './providers/ollama-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { RequestyProvider } from './providers/requesty-provider';
import { LLMProvider, CommonLLMOptions, CommonLLMResponse } from './types';

export class LLMService {
  private providers: Map<LLMProvider, BaseLLMProvider>;
  private defaultProvider: LLMProvider = LLMProvider.OLLAMA;

  constructor() {
    this.providers = new Map();
    // Initialize available providers
    this.providers.set(LLMProvider.OLLAMA, new OllamaProvider());
    this.providers.set(LLMProvider.ANTHROPIC, new AnthropicProvider());
    this.providers.set(LLMProvider.GOOGLE, new GeminiProvider());
    this.providers.set(LLMProvider.REQUESTY, new RequestyProvider());
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
    userPrompt: string,
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
    prompt: string,
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
