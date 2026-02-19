/**
 * Google Vertex AI Provider
 * Uses Service Account authentication for CDPA/GDPR compliant LLM usage with EU hosting.
 *
 * Key differences from Gemini Direct API:
 * - Uses OAuth2 Bearer Token instead of API Key
 * - Supports regional endpoints (e.g., europe-west3 for Frankfurt)
 * - Requires Google Cloud Project ID
 * - Service Account JSON for authentication
 */

import { AxiosRequestConfig } from 'axios';
import { GoogleAuth, JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../../../shared/utils/logging.utils';
import { LLMProvider, CommonLLMResponse, RegionRotationConfig } from '../../types';
import { isQuotaError } from '../../utils/retry.utils';
import { MultimodalContent } from '../../types/multimodal.types';
import { GeminiBaseProvider, GeminiProviderOptions } from './gemini-base.provider';

/**
 * Supported EU regions for Vertex AI.
 * See: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
 */
export type VertexAIRegion =
  | 'europe-west1'    // Belgium
  | 'europe-west2'    // London
  | 'europe-west3'    // Frankfurt
  | 'europe-west4'    // Netherlands
  | 'europe-west6'    // Zurich
  | 'europe-west8'    // Milan
  | 'europe-west9'    // Paris
  | 'europe-north1'   // Finland
  | 'europe-central2' // Warsaw
  | 'europe-southwest1' // Madrid
  | 'us-central1'     // Iowa (for testing)
  | 'us-east4'        // Virginia
  | 'global';         // Global endpoint (no data residency guarantee)

/**
 * Extended options for Vertex AI provider.
 */
export interface VertexAIProviderOptions extends GeminiProviderOptions {
  /** Google Cloud Project ID */
  projectId?: string;

  /** Vertex AI region (default: europe-west3 for Frankfurt) */
  region?: VertexAIRegion;

  /** Path to service account JSON file */
  serviceAccountKeyPath?: string;

  /** Service account JSON content (alternative to path) */
  serviceAccountKey?: object;
}

/**
 * Cached access token with expiry time.
 */
interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Configuration for the VertexAI provider instance.
 */
export interface VertexAIProviderConfig {
  /** Opt-in region rotation for quota errors (429 / Resource Exhausted). */
  regionRotation?: RegionRotationConfig;
}

/**
 * Vertex AI provider with Service Account authentication.
 *
 * Environment variables:
 * - GOOGLE_CLOUD_PROJECT: Google Cloud Project ID
 * - VERTEX_AI_REGION: Region for data residency (default: europe-west3)
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON file
 * - VERTEX_AI_MODEL: Default model name
 *
 * For credential security:
 * - Never commit service account JSON to git
 * - Use GOOGLE_APPLICATION_CREDENTIALS to point to the JSON file
 * - The JSON file should be in .gitignore
 */
export class VertexAIProvider extends GeminiBaseProvider {
  private tokenCache: CachedToken | null = null;
  private authClient: JWT | null = null;
  private readonly regionRotationConfig: RegionRotationConfig | null;

  // Buffer time before token expiry to refresh (5 minutes)
  private readonly TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

  constructor(config?: VertexAIProviderConfig) {
    super(LLMProvider.VERTEX_AI);
    this.regionRotationConfig = config?.regionRotation ?? null;

    // Validate regionRotation config
    if (this.regionRotationConfig) {
      if (!this.regionRotationConfig.regions || this.regionRotationConfig.regions.length === 0) {
        throw new Error('regionRotation.regions must contain at least one region');
      }
      if (!this.regionRotationConfig.fallback) {
        throw new Error('regionRotation.fallback is required');
      }
    }
  }

  /**
   * Get the base URL for Vertex AI API.
   * Regional endpoints ensure data residency compliance.
   * Preview models automatically use global endpoint.
   */
  protected getBaseUrl(model: string, options: VertexAIProviderOptions): string {
    const region = this.getEffectiveRegion(model, options);

    if (region === 'global') {
      return 'https://aiplatform.googleapis.com';
    }

    return `https://${region}-aiplatform.googleapis.com`;
  }

  /**
   * Get the full endpoint URL for generateContent.
   * Format: {baseUrl}/v1beta1/projects/{projectId}/locations/{region}/publishers/google/models/{model}:generateContent
   *
   * Note: We use v1beta1 because ThinkingConfig is only available in the beta API.
   */
  protected getEndpointUrl(model: string, options: VertexAIProviderOptions): string {
    const baseUrl = this.getBaseUrl(model, options);
    const projectId = this.getProjectId(options);
    const region = this.getEffectiveRegion(model, options);

    return `${baseUrl}/v1beta1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
  }

  /**
   * Get the authentication config using OAuth2 Bearer Token.
   */
  protected async getAuthConfig(_options: VertexAIProviderOptions): Promise<AxiosRequestConfig> {
    const accessToken = await this.getAccessToken(_options);

    return {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };
  }

  /**
   * Get the default model for Vertex AI.
   */
  protected getDefaultModel(): string {
    return process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Get the Google Cloud Project ID.
   */
  private getProjectId(options: VertexAIProviderOptions): string {
    const projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT;

    if (!projectId) {
      throw new Error(
        'Google Cloud Project ID is required for Vertex AI. ' +
        'Please set GOOGLE_CLOUD_PROJECT in your .env file or pass projectId in options.'
      );
    }

    return projectId;
  }

  /**
   * Check if a model is a preview model that requires global endpoint.
   * Preview models are not available in regional endpoints.
   */
  private isPreviewModel(model: string): boolean {
    return model.toLowerCase().includes('-preview');
  }

  /**
   * Get the configured region from options or environment.
   */
  private getConfiguredRegion(options: VertexAIProviderOptions): VertexAIRegion {
    return options.region ||
      (process.env.VERTEX_AI_REGION as VertexAIRegion) ||
      'europe-west3'; // Default to Frankfurt for EU compliance
  }

  /**
   * Get the effective region, considering preview model requirements.
   * Preview models automatically use global endpoint with a warning.
   */
  private getEffectiveRegion(model: string, options: VertexAIProviderOptions): VertexAIRegion {
    const configuredRegion = this.getConfiguredRegion(options);

    // Preview models require global endpoint
    if (this.isPreviewModel(model) && configuredRegion !== 'global') {
      logger.warn('Preview model detected - using global endpoint (no EU data residency guarantee)', {
        context: 'VertexAIProvider',
        metadata: {
          model,
          configuredRegion,
          effectiveRegion: 'global'
        }
      });
      return 'global';
    }

    return configuredRegion;
  }

  /**
   * Get an access token, using cache if valid.
   */
  private async getAccessToken(options: VertexAIProviderOptions): Promise<string> {
    // Check if cached token is still valid
    if (this.tokenCache && this.isTokenValid(this.tokenCache)) {
      return this.tokenCache.token;
    }

    // Get fresh token
    const token = await this.fetchAccessToken(options);
    return token;
  }

  /**
   * Check if a cached token is still valid.
   */
  private isTokenValid(cached: CachedToken): boolean {
    return Date.now() < (cached.expiresAt - this.TOKEN_REFRESH_BUFFER_MS);
  }

  /**
   * Fetch a fresh access token using service account credentials.
   */
  private async fetchAccessToken(options: VertexAIProviderOptions): Promise<string> {
    try {
      // Initialize auth client if not already done
      if (!this.authClient) {
        this.authClient = await this.initializeAuthClient(options);
      }

      // Get credentials (this handles token refresh automatically)
      const credentials = await this.authClient.getAccessToken();

      if (!credentials.token) {
        throw new Error('Failed to obtain access token from service account');
      }

      // Cache the token
      // JWT tokens from google-auth-library typically expire in 1 hour
      this.tokenCache = {
        token: credentials.token,
        expiresAt: Date.now() + 3600 * 1000 // 1 hour from now
      };

      logger.info('Obtained fresh Vertex AI access token', {
        context: 'VertexAIProvider',
        metadata: {
          expiresIn: '1 hour'
        }
      });

      return credentials.token;
    } catch (error: any) {
      logger.error('Failed to fetch Vertex AI access token', {
        context: 'VertexAIProvider',
        metadata: {
          error: error.message
        }
      });
      throw new Error(
        `Failed to authenticate with Vertex AI: ${error.message}. ` +
        'Please check your service account credentials.'
      );
    }
  }

  /**
   * Initialize the authentication client from service account credentials.
   */
  private async initializeAuthClient(options: VertexAIProviderOptions): Promise<JWT> {
    let credentials: any;

    // Try to load credentials from various sources
    if (options.serviceAccountKey) {
      // Direct JSON object provided
      credentials = options.serviceAccountKey;
    } else if (options.serviceAccountKeyPath) {
      // Path to JSON file provided in options
      credentials = this.loadCredentialsFromFile(options.serviceAccountKeyPath);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Standard Google Cloud environment variable
      credentials = this.loadCredentialsFromFile(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } else if (process.env.VERTEX_AI_SERVICE_ACCOUNT_KEY) {
      // JSON string in environment variable
      try {
        credentials = JSON.parse(process.env.VERTEX_AI_SERVICE_ACCOUNT_KEY);
      } catch (e) {
        throw new Error('VERTEX_AI_SERVICE_ACCOUNT_KEY is not valid JSON');
      }
    } else {
      throw new Error(
        'Vertex AI service account credentials not found. Please provide one of:\n' +
        '- GOOGLE_APPLICATION_CREDENTIALS environment variable (path to JSON file)\n' +
        '- VERTEX_AI_SERVICE_ACCOUNT_KEY environment variable (JSON string)\n' +
        '- serviceAccountKeyPath in options\n' +
        '- serviceAccountKey in options'
      );
    }

    // Validate required fields
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error(
        'Invalid service account credentials: missing client_email or private_key'
      );
    }

    // Create JWT client with Vertex AI scope
    const client = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    logger.info('Initialized Vertex AI auth client', {
      context: 'VertexAIProvider',
      metadata: {
        clientEmail: credentials.client_email,
        projectId: credentials.project_id
      }
    });

    return client;
  }

  /**
   * Load credentials from a JSON file.
   */
  private loadCredentialsFromFile(filePath: string): any {
    try {
      // Resolve relative paths
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Service account file not found: ${resolvedPath}`);
      }

      const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Service account file not found: ${filePath}`);
      }
      throw new Error(`Failed to load service account file: ${error.message}`);
    }
  }

  /**
   * Override callWithSystemMessage to add region rotation on quota errors.
   * When regionRotation is configured, rotates through regions on 429 errors.
   * Without regionRotation config, delegates directly to base class (backwards compatible).
   */
  public async callWithSystemMessage(
    userPrompt: MultimodalContent,
    systemMessage: string,
    options: GeminiProviderOptions = {}
  ): Promise<CommonLLMResponse | null> {
    // No rotation configured → use base implementation directly
    if (!this.regionRotationConfig) {
      return super.callWithSystemMessage(userPrompt, systemMessage, options);
    }

    const rotation = this.regionRotationConfig;
    const model = options.model || this.getDefaultModel();

    // Preview models use global endpoint → no rotation
    if (this.isPreviewModel(model)) {
      return super.callWithSystemMessage(userPrompt, systemMessage, options);
    }

    // Build region sequence: [...regions, fallback]
    const regionSequence = [...rotation.regions, rotation.fallback];
    let regionIndex = 0;

    logger.info('Region rotation enabled for Vertex AI LLM call', {
      context: 'VertexAIProvider',
      metadata: { sequence: regionSequence, model }
    });

    // Mutable options object — onRetry mutates the region
    const mutableOptions: GeminiProviderOptions = {
      ...options,
      region: rotation.regions[0] as string,
      _retryHooks: {
        onRetry: (error: any) => {
          if (isQuotaError(error) && regionIndex < regionSequence.length - 1) {
            regionIndex++;
            mutableOptions.region = regionSequence[regionIndex] as string;
            logger.info(`Quota error — rotating to region ${mutableOptions.region}`, {
              context: 'VertexAIProvider',
              metadata: {
                regionIndex,
                totalRegions: regionSequence.length,
                region: mutableOptions.region
              }
            });
          }
          // Non-quota retryable errors (500, 503, timeout): stay on same region
        }
      }
    };

    try {
      return await super.callWithSystemMessage(userPrompt, systemMessage, mutableOptions);
    } catch (error) {
      // Bonus fallback attempt: after retry budget exhausted, one more try on fallback
      if (
        isQuotaError(error) &&
        rotation.alwaysTryFallback !== false &&
        mutableOptions.region !== rotation.fallback
      ) {
        logger.info(`Retry budget exhausted — bonus attempt on fallback region ${rotation.fallback}`, {
          context: 'VertexAIProvider',
          metadata: {
            exhaustedRegion: mutableOptions.region,
            fallback: rotation.fallback
          }
        });

        mutableOptions.region = rotation.fallback as string;
        // Remove retry hooks and disable retries for the single bonus attempt
        delete mutableOptions._retryHooks;
        mutableOptions.retry = { ...mutableOptions.retry, maxRetries: 0 };
        return await super.callWithSystemMessage(userPrompt, systemMessage, mutableOptions);
      }
      throw error;
    }
  }

  /**
   * Clear the token cache (useful for testing or after errors).
   */
  public clearTokenCache(): void {
    this.tokenCache = null;
    this.authClient = null;
  }
}

// Default singleton instance (without region rotation, for backwards compatibility)
export const vertexAIProvider = new VertexAIProvider();
