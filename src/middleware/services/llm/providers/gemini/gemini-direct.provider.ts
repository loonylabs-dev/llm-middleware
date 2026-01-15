/**
 * Google Gemini Direct API Provider
 * Uses API Key authentication with generativelanguage.googleapis.com
 */

import { AxiosRequestConfig } from 'axios';
import { LLMProvider } from '../../types';
import { GeminiBaseProvider, GeminiProviderOptions } from './gemini-base.provider';

/**
 * Gemini Direct API provider using API Key authentication.
 * This is the simpler authentication method for development and testing.
 *
 * Environment variables:
 * - GEMINI_API_KEY or GOOGLE_API_KEY: Your Google Gemini API key
 * - GEMINI_MODEL: Default model name (e.g., 'gemini-1.5-pro', 'gemini-3-flash-preview')
 */
export class GeminiDirectProvider extends GeminiBaseProvider {
  private readonly BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    super(LLMProvider.GOOGLE);
  }

  /**
   * Get the base URL for the Gemini Direct API.
   */
  protected getBaseUrl(_model: string, _options: GeminiProviderOptions): string {
    return this.BASE_URL;
  }

  /**
   * Get the full endpoint URL for generateContent.
   */
  protected getEndpointUrl(model: string, _options: GeminiProviderOptions): string {
    return `${this.BASE_URL}/models/${model}:generateContent`;
  }

  /**
   * Get the authentication config using API key as query parameter.
   */
  protected async getAuthConfig(options: GeminiProviderOptions): Promise<AxiosRequestConfig> {
    const authToken = options.authToken || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!authToken) {
      throw new Error(
        'Google Gemini API key is required but not provided. ' +
        'Please set GEMINI_API_KEY or GOOGLE_API_KEY in your .env file or pass authToken in options.'
      );
    }

    return {
      params: {
        key: authToken
      }
    };
  }

  /**
   * Get the default model for Gemini Direct API.
   */
  protected getDefaultModel(): string {
    return process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  }
}

// Export singleton instance
export const geminiDirectProvider = new GeminiDirectProvider();
