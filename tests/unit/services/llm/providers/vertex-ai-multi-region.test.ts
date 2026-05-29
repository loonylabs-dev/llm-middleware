/**
 * VertexAI Multi-Region Endpoint Tests
 *
 * Verifies endpoint URL construction:
 * - multi-region locations (eu / us) use the dedicated `.rep.` hostname
 * - single regions keep the `{region}-aiplatform` pattern
 * - global uses the plain host
 * - preview models fall back to global even when a region is configured
 *
 * Background: Gemini 3.1 Flash-Lite and 3.5 Flash (GA) are served ONLY via the
 * `eu` multi-region, not by single EU regions (verified live). The `.rep.`
 * hostname is required for multi-region routing.
 */

// Mock logger to silence preview warning
jest.mock('../../../../../src/middleware/shared/utils/logging.utils', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn(), system: jest.fn() },
}));

// Mock google-auth-library (avoids real auth + jest dynamic-import incompatibility)
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn(),
  JWT: jest.fn(),
}));

import { VertexAIProvider } from '../../../../../src/middleware/services/llm/providers/gemini/vertex-ai.provider';

/** Exposes the protected URL builders for direct assertions. */
class TestableVertexAIProvider extends VertexAIProvider {
  public baseUrl(model: string, options: any): string {
    return (this as any).getBaseUrl(model, options);
  }
  public endpointUrl(model: string, options: any): string {
    return (this as any).getEndpointUrl(model, options);
  }
}

describe('VertexAIProvider — multi-region endpoints', () => {
  let provider: TestableVertexAIProvider;

  beforeEach(() => {
    provider = new TestableVertexAIProvider();
  });

  it('builds the .rep. host for the eu multi-region', () => {
    expect(provider.baseUrl('gemini-3.5-flash', { region: 'eu', projectId: 'p' }))
      .toBe('https://aiplatform.eu.rep.googleapis.com');
  });

  it('builds the .rep. host for the us multi-region', () => {
    expect(provider.baseUrl('gemini-3.5-flash', { region: 'us', projectId: 'p' }))
      .toBe('https://aiplatform.us.rep.googleapis.com');
  });

  it('keeps the {region}-aiplatform host for single regions', () => {
    expect(provider.baseUrl('gemini-2.5-flash', { region: 'europe-west3', projectId: 'p' }))
      .toBe('https://europe-west3-aiplatform.googleapis.com');
  });

  it('uses the plain host for the global endpoint', () => {
    expect(provider.baseUrl('gemini-2.5-flash', { region: 'global', projectId: 'p' }))
      .toBe('https://aiplatform.googleapis.com');
  });

  it('builds a full eu endpoint URL with /locations/eu/ and the .rep. host', () => {
    expect(provider.endpointUrl('gemini-3.5-flash', { region: 'eu', projectId: 'my-proj' }))
      .toBe('https://aiplatform.eu.rep.googleapis.com/v1beta1/projects/my-proj/locations/eu/publishers/google/models/gemini-3.5-flash:generateContent');
  });

  it('forces global for preview models even when eu is configured', () => {
    expect(provider.baseUrl('gemini-3-flash-preview', { region: 'eu', projectId: 'p' }))
      .toBe('https://aiplatform.googleapis.com');
  });
});
