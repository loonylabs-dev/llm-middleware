// Base types and interfaces
export * from './client-info';
export * from './base-request.types';

// Configuration types
export interface LLMModelConfig {
  name: string | undefined;  // Can be undefined if not set in env
  baseUrl: string;
  bearerToken?: string;
  temperature: number;
  description?: string;
  /** Region for Vertex AI (e.g., 'europe-west1'). Optional for other providers. */
  region?: string;
}

// Validated config with required name
export interface ValidatedLLMModelConfig extends Omit<LLMModelConfig, 'name'> {
  name: string;  // Guaranteed to exist after validation
}

export type ModelsConfigMap = Record<string, LLMModelConfig>;

// Logging types
export type AuthValidationType = 'none' | 'supabase' | 'static';

export interface AppConfig {
  server: {
    port: number;
    environment: string;
  };
  auth: {
    validationType: AuthValidationType;
    supabase?: {
      url: string | null;
      key: string | null;
      serviceKey: string | null;
    };
    staticKey?: {
      apiKey: string | null;
    };
  };
  logging: {
    level: string;
    console: {
      enabled: boolean;
      colorized: boolean;
    };
    database: {
      enabled: boolean;
      minLevel: string;
    };
  };
}