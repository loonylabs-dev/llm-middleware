/**
 * Interface for model parameters used in AI requests.
 * All parameters are optional except temperature.
 */
export interface ModelParameters {
  /** 
   * Controls randomness in generation (0.0 = deterministic, 2.0 = very random).
   * - 0.0-0.3: Factual, focused output
   * - 0.4-0.7: Balanced
   * - 0.8-1.2: Creative, varied
   * Range: 0.0-2.0, Default: 0.8
   */
  temperature: number;
  
  /** 
   * Penalizes token repetition (higher = less repetition).
   * Range: 0.0-2.0, Default: 1.1
   */
  repeatPenalty?: number;
  
  /** 
   * Nucleus sampling threshold - limits token selection to cumulative probability.
   * Range: 0.0-1.0, Default: 0.9
   */
  topP?: number;
  
  /** 
   * Limits token selection to k most likely tokens.
   * Range: 1-100, Default: 40
   */
  topK?: number;
  
  /** 
   * Penalizes tokens proportional to their frequency (reduces overused words).
   * Range: -2.0-2.0, Default: 0.0
   */
  frequencyPenalty?: number;
  
  /** 
   * Penalizes all previously used tokens equally (encourages new concepts).
   * Range: -2.0-2.0, Default: 0.0
   */
  presencePenalty?: number;
  
  /** 
   * Number of previous tokens to consider for repetition penalty.
   * Use -1 to consider entire context window (num_ctx).
   * Range: 0-2048 or -1, Default: 64
   */
  repeatLastN?: number;
  
  /** 
   * Maximum number of tokens to generate in the response.
   * Controls output length.
   * Range: 1+, Default: 128 (model-specific)
   */
  numPredict?: number;
  
  /** 
   * Context window size in tokens.
   * Larger values allow model to reference more previous text.
   * Range: 128-4096+ (model-specific), Default: 2048
   */
  numCtx?: number;
  
  /** 
   * Number of tokens to process in parallel during generation.
   * Higher values = faster but more memory usage.
   * Range: 1-512, Default: 512 (model-specific)
   */
  numBatch?: number;
}

/**
 * Interface for parameter overrides that can be applied to default model parameters.
 * All parameters are optional - only specify what you want to override.
 *
 * **Provider-Agnostic Design:**
 * - Use `maxTokens` for cross-provider compatibility (recommended)
 * - Provider-specific parameters (num_predict, num_ctx) available for advanced Ollama tuning
 */
export interface ModelParameterOverrides {
  /** Override the base temperature setting */
  temperatureOverride?: number;

  // ===== Provider-Agnostic Parameters (Recommended) =====

  /**
   * Maximum number of tokens to generate in the response.
   * **Provider-agnostic** - works across all providers:
   * - Anthropic: Maps to max_tokens
   * - OpenAI: Maps to max_tokens
   * - Ollama: Maps to num_predict
   * - Google: Maps to maxOutputTokens
   *
   * Range: 1+ (provider-specific limits apply)
   * Default: Provider-specific (typically 4096 for Anthropic, 128-2048 for Ollama)
   */
  maxTokens?: number;

  /** Repeat penalty override */
  repeatPenalty?: number;
  /** Nucleus sampling (top-p) override */
  topP?: number;
  /** Top-k sampling override */
  topK?: number;
  /** Frequency penalty override */
  frequencyPenalty?: number;
  /** Presence penalty override */
  presencePenalty?: number;
  /** Repeat last N tokens override */
  repeatLastN?: number;

  // ===== Ollama-Specific Parameters (Advanced Control) =====

  /**
   * @deprecated Prefer `maxTokens` for provider-agnostic code.
   * Maximum tokens to generate (Ollama-specific: num_predict).
   * Only use this if you need Ollama-specific behavior different from maxTokens.
   * If both maxTokens and num_predict are set, num_predict takes precedence for Ollama.
   */
  num_predict?: number;
  /**
   * Context window size (Ollama-specific: num_ctx).
   * No provider-agnostic equivalent - use only for Ollama fine-tuning.
   */
  num_ctx?: number;
  /**
   * Batch size for parallel processing (Ollama-specific: num_batch).
   * No provider-agnostic equivalent - use only for Ollama performance tuning.
   */
  num_batch?: number;
}

/**
 * Interface for model configuration from models.config
 */
export interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
  contextLength?: number;
}

/**
 * Service for managing and validating model parameters for AI requests
 * Handles parameter combination, validation, and conversion to API formats
 */
export class ModelParameterManagerService {
  private static readonly DEFAULT_TEMPERATURE = 0.7;

  /**
   * Get the effective model parameters, combining config defaults and use case overrides
   * @param modelConfig The model configuration from models.config
   * @param overrides Optional overrides from the use case
   * @returns Final model parameters to use
   */
  public static getEffectiveParameters(
    modelConfig: ModelConfig,
    overrides: ModelParameterOverrides = {}
  ): ModelParameters {
    // For Ollama compatibility: num_predict takes precedence over maxTokens
    // This allows advanced users to have fine-grained Ollama control while
    // still supporting the provider-agnostic maxTokens parameter
    const effectiveNumPredict = overrides.num_predict ?? overrides.maxTokens;

    return {
      temperature: overrides.temperatureOverride ?? modelConfig.temperature ?? this.DEFAULT_TEMPERATURE,
      repeatPenalty: overrides.repeatPenalty,
      topP: overrides.topP,
      topK: overrides.topK,
      frequencyPenalty: overrides.frequencyPenalty,
      presencePenalty: overrides.presencePenalty,
      repeatLastN: overrides.repeatLastN,
      numPredict: effectiveNumPredict,
      numCtx: overrides.num_ctx,
      numBatch: overrides.num_batch
    };
  }

  /**
   * Validate parameter values are within acceptable ranges
   * @param parameters The parameters to validate
   * @returns Validated parameters with any out-of-range values corrected
   */
  public static validateParameters(parameters: ModelParameters): ModelParameters {
    const validated = { ...parameters };

    // Temperature should be between 0 and 2
    if (validated.temperature < 0) validated.temperature = 0;
    if (validated.temperature > 2) validated.temperature = 2;

    // Repeat penalty should be > 0
    if (validated.repeatPenalty !== undefined) {
      if (validated.repeatPenalty <= 0) validated.repeatPenalty = 1.0;
    }

    // Top-p should be between 0 and 1
    if (validated.topP !== undefined) {
      if (validated.topP < 0) validated.topP = 0;
      if (validated.topP > 1) validated.topP = 1;
    }

    // Top-k should be positive integer
    if (validated.topK !== undefined) {
      if (validated.topK < 1) validated.topK = 1;
      validated.topK = Math.round(validated.topK);
    }

    // Frequency penalty should be between 0 and 2
    if (validated.frequencyPenalty !== undefined) {
      if (validated.frequencyPenalty < 0) validated.frequencyPenalty = 0;
      if (validated.frequencyPenalty > 2) validated.frequencyPenalty = 2;
    }

    // Presence penalty should be between 0 and 2
    if (validated.presencePenalty !== undefined) {
      if (validated.presencePenalty < 0) validated.presencePenalty = 0;
      if (validated.presencePenalty > 2) validated.presencePenalty = 2;
    }

    // repeatLastN should be a positive number or -1 for num_ctx
    if (validated.repeatLastN !== undefined) {
      if (validated.repeatLastN < -1) validated.repeatLastN = 64; // Default fallback
      // If not -1 (for num_ctx), round to whole number
      if (validated.repeatLastN !== -1) {
        validated.repeatLastN = Math.round(validated.repeatLastN);
      }
    }

    // numPredict should be a positive integer (max tokens to generate)
    // Note: This applies to both provider-agnostic maxTokens and Ollama-specific num_predict
    if (validated.numPredict !== undefined) {
      if (validated.numPredict < 1) validated.numPredict = 1;
      validated.numPredict = Math.round(validated.numPredict);
    }

    // numCtx should be a positive integer (context window size)
    if (validated.numCtx !== undefined) {
      if (validated.numCtx < 128) validated.numCtx = 128; // Minimum context
      validated.numCtx = Math.round(validated.numCtx);
    }

    // numBatch should be a positive integer (batch size)
    if (validated.numBatch !== undefined) {
      if (validated.numBatch < 1) validated.numBatch = 1;
      validated.numBatch = Math.round(validated.numBatch);
    }

    return validated;
  }

  /**
   * Create parameter subset for logging (only non-undefined values)
   * @param parameters The parameters to filter
   * @returns Object with only defined parameters
   */
  public static getDefinedParameters(parameters: ModelParameters): Record<string, any> {
    const result: Record<string, any> = {
      temperature: parameters.temperature
    };

    if (parameters.repeatPenalty !== undefined) {
      result.repeatPenalty = parameters.repeatPenalty;
    }
    if (parameters.topP !== undefined) {
      result.topP = parameters.topP;
    }
    if (parameters.topK !== undefined) {
      result.topK = parameters.topK;
    }
    if (parameters.frequencyPenalty !== undefined) {
      result.frequencyPenalty = parameters.frequencyPenalty;
    }
    if (parameters.presencePenalty !== undefined) {
      result.presencePenalty = parameters.presencePenalty;
    }
    if (parameters.repeatLastN !== undefined) {
      result.repeatLastN = parameters.repeatLastN;
    }
    if (parameters.numPredict !== undefined) {
      result.numPredict = parameters.numPredict;
    }
    if (parameters.numCtx !== undefined) {
      result.numCtx = parameters.numCtx;
    }
    if (parameters.numBatch !== undefined) {
      result.numBatch = parameters.numBatch;
    }
    return result;
  }

  /**
   * Create parameter object for Ollama API request
   * @param parameters The validated parameters
   * @returns Object suitable for the Ollama API options field
   */
  public static toOllamaOptions(parameters: ModelParameters): Record<string, any> {
    const options: Record<string, any> = {};

    // Add temperature (always included)
    options.temperature = parameters.temperature;

    // Add optional parameters with correct Ollama API names
    if (parameters.repeatPenalty !== undefined) {
      options.repeat_penalty = parameters.repeatPenalty;
    }
    if (parameters.topP !== undefined) {
      options.top_p = parameters.topP;
    }
    if (parameters.topK !== undefined) {
      options.top_k = parameters.topK;
    }
    if (parameters.frequencyPenalty !== undefined) {
      options.frequency_penalty = parameters.frequencyPenalty;
    }
    if (parameters.presencePenalty !== undefined) {
      options.presence_penalty = parameters.presencePenalty;
    }
    if (parameters.repeatLastN !== undefined) {
      options.repeat_last_n = parameters.repeatLastN;
    }
    if (parameters.numPredict !== undefined) {
      options.num_predict = parameters.numPredict;
    }
    if (parameters.numCtx !== undefined) {
      options.num_ctx = parameters.numCtx;
    }
    if (parameters.numBatch !== undefined) {
      options.num_batch = parameters.numBatch;
    }

    return options;
  }

  /**
   * Create default parameters for a given model type or use case
   * 
   * Available presets:
   * - 'creative' / 'creative_writing': Optimized for novels, stories, narrative fiction
   * - 'factual': Optimized for reports, documentation, journalism
   * - 'poetic': Optimized for poetry, lyrics, artistic expression
   * - 'dialogue': Optimized for character dialogue, conversational content
   * - 'technical': Optimized for code documentation, technical guides
   * - 'marketing': Optimized for advertisements, promotional content
   * - 'analytical': General analytical tasks (legacy)
   * - 'balanced': General balanced approach (default)
   * 
   * @param modelType The type of model or use case
   * @returns Default parameters for the model type
   * 
   * For detailed documentation about each preset, see docs/OLLAMA_PARAMETERS.md
   */
  public static getDefaultParametersForType(modelType: string): ModelParameters {
    switch (modelType.toLowerCase()) {
      // Creative Writing preset - for novels, stories, narrative fiction
      case 'creative':
      case 'creative_writing':
        return {
          temperature: 0.8,
          repeatPenalty: 1.3,
          frequencyPenalty: 0.2,
          presencePenalty: 0.2,
          topP: 0.92,
          topK: 60,
          repeatLastN: 128
        };
      
      // Factual Content preset - for reports, documentation, journalism
      case 'factual':
        return {
          temperature: 0.4,
          repeatPenalty: 1.2,
          frequencyPenalty: 0.1,
          presencePenalty: 0.1,
          topP: 0.85,
          topK: 40,
          repeatLastN: 96
        };
      
      // Poetic Text preset - for poetry, lyrics, artistic expression
      case 'poetic':
      case 'poetry':
        return {
          temperature: 1.0,
          repeatPenalty: 1.2,
          frequencyPenalty: 0.3,
          presencePenalty: 0.2,
          topP: 0.95,
          topK: 80,
          repeatLastN: 64
        };
      
      // Dialogue & Conversation preset - for character dialogue, chat
      case 'dialogue':
      case 'conversation':
      case 'conversational':
        return {
          temperature: 0.7,
          repeatPenalty: 1.1,
          frequencyPenalty: 0.3,
          presencePenalty: 0.0,
          topP: 0.9,
          topK: 50,
          repeatLastN: 32
        };
      
      // Technical Documentation preset - for code docs, API references
      case 'technical':
      case 'tech':
      case 'documentation':
        return {
          temperature: 0.3,
          repeatPenalty: 1.05,
          frequencyPenalty: 0.0,
          presencePenalty: 0.1,
          topP: 0.8,
          topK: 30,
          repeatLastN: 128
        };
      
      // Marketing Copy preset - for ads, sales copy, promotional content
      case 'marketing':
      case 'advertising':
      case 'promotional':
        return {
          temperature: 0.7,
          repeatPenalty: 1.3,
          frequencyPenalty: 0.4,
          presencePenalty: 0.3,
          topP: 0.9,
          topK: 60,
          repeatLastN: 96
        };
      
      // Legacy presets for backward compatibility
      case 'analytical':
        return {
          temperature: 0.3,
          topP: 0.8,
          repeatPenalty: 1.05
        };
      
      // Balanced preset (default)
      case 'balanced':
      default:
        return {
          temperature: this.DEFAULT_TEMPERATURE,
          topP: 0.9,
          repeatPenalty: 1.1
        };
    }
  }

  /**
   * Compare two parameter sets and return the differences
   * @param params1 First parameter set
   * @param params2 Second parameter set
   * @returns Object showing differences
   */
  public static compareParameters(
    params1: ModelParameters, 
    params2: ModelParameters
  ): Record<string, { from: any; to: any }> {
    const differences: Record<string, { from: any; to: any }> = {};

    const allKeys = new Set([
      ...Object.keys(params1),
      ...Object.keys(params2)
    ]) as Set<keyof ModelParameters>;

    for (const key of allKeys) {
      if (params1[key] !== params2[key]) {
        differences[key] = {
          from: params1[key],
          to: params2[key]
        };
      }
    }

    return differences;
  }

  /**
   * Generate a summary string of the parameters for logging
   * @param parameters The parameters to summarize
   * @returns Human-readable parameter summary
   */
  public static summarizeParameters(parameters: ModelParameters): string {
    const defined = this.getDefinedParameters(parameters);
    const parts = Object.entries(defined).map(([key, value]) => `${key}=${value}`);
    return parts.join(', ');
  }
}