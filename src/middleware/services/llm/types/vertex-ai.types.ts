/**
 * Google Vertex AI specific types
 * Extends Gemini types with Vertex AI specific configuration
 */

import { GeminiRequestOptions } from './gemini.types';

/**
 * Supported regions for Vertex AI with Gemini models.
 * EU regions provide GDPR/CDPA compliance with data residency guarantees.
 *
 * See: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
 */
export type VertexAIRegion =
  // EU Regions (GDPR compliant)
  | 'europe-west1'      // Belgium
  | 'europe-west2'      // London, UK
  | 'europe-west3'      // Frankfurt, Germany (recommended for DACH)
  | 'europe-west4'      // Netherlands
  | 'europe-west6'      // Zurich, Switzerland
  | 'europe-west8'      // Milan, Italy
  | 'europe-west9'      // Paris, France
  | 'europe-north1'     // Finland
  | 'europe-central2'   // Warsaw, Poland
  | 'europe-southwest1' // Madrid, Spain
  // US Regions (for testing/fallback)
  | 'us-central1'       // Iowa
  | 'us-east4'          // Virginia
  // Global endpoint (no data residency guarantee)
  | 'global';

/**
 * Vertex AI specific request options.
 * Extends Gemini options with Vertex AI configuration.
 */
export interface VertexAIRequestOptions extends GeminiRequestOptions {
  /** Google Cloud Project ID (required) */
  projectId?: string;

  /**
   * Vertex AI region for data residency.
   * Default: 'europe-west3' (Frankfurt) for EU compliance.
   */
  region?: VertexAIRegion;

  /**
   * Path to service account JSON file.
   * Alternative to GOOGLE_APPLICATION_CREDENTIALS env var.
   */
  serviceAccountKeyPath?: string;

  /**
   * Service account JSON content as object.
   * Use for environments where file access is restricted.
   */
  serviceAccountKey?: object;
}

/**
 * Service account JSON structure (partial, key fields only).
 */
export interface ServiceAccountCredentials {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}
