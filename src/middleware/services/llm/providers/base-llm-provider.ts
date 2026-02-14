/**
 * Base abstract class for all LLM providers
 * Defines the contract that all providers must implement
 */

import { CommonLLMOptions, CommonLLMResponse, LLMProvider } from '../types';
import { MultimodalContent } from '../types/multimodal.types';

export abstract class BaseLLMProvider {
  protected providerName: LLMProvider;

  constructor(providerName: LLMProvider) {
    this.providerName = providerName;
  }

  /**
   * Get the provider name
   */
  public getProviderName(): LLMProvider {
    return this.providerName;
  }

  /**
   * Call the LLM API with a custom system message
   * This is the main method that all providers must implement
   *
   * @param userPrompt - The user's prompt for the model
   * @param systemMessage - The system message defining AI behavior
   * @param options - Provider-specific options
   * @returns The API response or null on error
   */
  abstract callWithSystemMessage(
    userPrompt: MultimodalContent,
    systemMessage: string,
    options: CommonLLMOptions
  ): Promise<CommonLLMResponse | null>;

  /**
   * Call the LLM API with default system message
   *
   * @param prompt - The prompt for the model
   * @param options - Provider-specific options
   * @returns The API response or null on error
   */
  public async call(
    prompt: MultimodalContent,
    options: CommonLLMOptions = {}
  ): Promise<CommonLLMResponse | null> {
    const defaultSystemMessage = "You are a helpful assistant, who provides clear and precise answers.";
    return this.callWithSystemMessage(prompt, defaultSystemMessage, options);
  }

  /**
   * Validate that required configuration is present
   * Override this in specific providers if they need validation
   */
  protected validateConfig(options: CommonLLMOptions): void {
    if (!options.model) {
      throw new Error(
        `Model name is required for ${this.providerName} provider. ` +
        'Please ensure model is set in your options or environment variables.'
      );
    }
  }
}
