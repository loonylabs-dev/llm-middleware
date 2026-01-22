import * as fs from 'fs';
import * as path from 'path';
import { appConfig } from '../../../shared/config/app.config';
import { TextAnalyzer } from './text-analysis.utils';
import { LLMDebugInfo } from '../types';

/**
 * Comprehensive debugging utility for LLM API interactions
 * Provides console logging, file logging, and text analysis
 * Provider-agnostic: works with any LLM provider
 */
export class LLMDebugger {
  private static isMinimal = process.env.DEBUG_LLM_MINIMAL === 'true' || process.env.DEBUG_OLLAMA_MINIMAL === 'true';
  private static showResponseInConsole = process.env.DEBUG_LLM_RESPONSE_CONSOLE !== 'false' && process.env.DEBUG_OLLAMA_RESPONSE_CONSOLE !== 'false';

  private static isEnabled = process.env.DEBUG_LLM_REQUESTS === 'true' ||
                            process.env.DEBUG_OLLAMA_REQUESTS === 'true' ||
                            appConfig.server.environment === 'development';

  /**
   * Get logs directory for a specific provider
   */
  private static getLogsDir(provider: string): string {
    return path.join(process.cwd(), 'logs', 'llm', provider, 'requests');
  }

  /**
   * Ensure logs directory exists for a specific provider
   */
  static ensureLogsDirectory(provider: string): void {
    if (!this.isEnabled) return;

    const logsDir = this.getLogsDir(provider);

    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  /**
   * Format message for console output
   */
  static formatMessage(message: string): string {
    // Normalize line breaks for console
    return message
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ')
      .trim();
  }

  /**
   * Log request information to console
   */
  static logRequestToConsole(debugInfo: LLMDebugInfo): void {
    if (!this.isEnabled) return;

    // Build chapter/page identifier for console display
    let chapterPageId = '';
    if (debugInfo.chapterNumber && debugInfo.pageNumber) {
      chapterPageId = ` [C${debugInfo.chapterNumber}P${debugInfo.pageNumber}]`;
    } else if (debugInfo.chapterNumber) {
      chapterPageId = ` [C${debugInfo.chapterNumber}]`;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`🚀 LLM REQUEST [${debugInfo.provider.toUpperCase()}]${chapterPageId}`);
    console.log('='.repeat(80));
    console.log(`⏰ Timestamp: ${debugInfo.timestamp.toISOString()}`);
    console.log(`🤖 Model: ${debugInfo.model}`);
    console.log(`🌐 Base URL: ${debugInfo.baseUrl}`);
    console.log(`📁 Use Case: ${debugInfo.useCase || 'Unknown'}`);
    // Log request parameters (since 2.17.0)
    if (debugInfo.temperature !== undefined) {
      console.log(`🌡️  Temperature: ${debugInfo.temperature}`);
    }
    if (debugInfo.reasoningEffort) {
      console.log(`🧠 Reasoning Effort: ${debugInfo.reasoningEffort}`);
    }

    // Show chapter/page context prominently
    if (debugInfo.chapterNumber || debugInfo.pageNumber || debugInfo.pageName) {
      console.log(`📖 Context: Chapter ${debugInfo.chapterNumber || '?'}, Page ${debugInfo.pageNumber || '?'}${debugInfo.pageName ? ` (${debugInfo.pageName})` : ''}`);
    }

    // Show detailed info only if not minimal
    if (!this.isMinimal) {
      // Client request body
      if (debugInfo.clientRequestBody) {
        console.log('\n📱 CLIENT REQUEST BODY:');
        console.log('-'.repeat(50));
        console.log(JSON.stringify(debugInfo.clientRequestBody, null, 2));
      }

      console.log('\n📋 SYSTEM MESSAGE:');
      console.log('-'.repeat(50));
      console.log(this.formatMessage(debugInfo.systemMessage));

      console.log('\n👤 USER MESSAGE:');
      console.log('-'.repeat(50));
      console.log(this.formatMessage(debugInfo.userMessage));

      console.log('\n🔧 COMPLETE REQUEST DATA:');
      console.log('-'.repeat(50));
      console.log(JSON.stringify(debugInfo.requestData, null, 2));
    }

    console.log('='.repeat(80) + '\n');
  }

  /**
   * Log response information to console
   */
  static logResponseToConsole(debugInfo: LLMDebugInfo): void {
    if (!this.isEnabled) return;

    // Build chapter/page identifier for console display
    let chapterPageId = '';
    if (debugInfo.chapterNumber && debugInfo.pageNumber) {
      chapterPageId = ` [C${debugInfo.chapterNumber}P${debugInfo.pageNumber}]`;
    } else if (debugInfo.chapterNumber) {
      chapterPageId = ` [C${debugInfo.chapterNumber}]`;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`📥 LLM RESPONSE [${debugInfo.provider.toUpperCase()}]${chapterPageId}`);
    console.log('='.repeat(80));
    console.log(`⏰ Response Timestamp: ${debugInfo.responseTimestamp?.toISOString() || 'N/A'}`);
    console.log(`🤖 Model: ${debugInfo.model}`);
    console.log(`📁 Use Case: ${debugInfo.useCase || 'Unknown'}`);

    // Show chapter/page context prominently
    if (debugInfo.chapterNumber || debugInfo.pageNumber || debugInfo.pageName) {
      console.log(`📖 Context: Chapter ${debugInfo.chapterNumber || '?'}, Page ${debugInfo.pageNumber || '?'}${debugInfo.pageName ? ` (${debugInfo.pageName})` : ''}`);
    }

    // Detailed logs only if not minimal
    if (!this.isMinimal) {
      if (debugInfo.response) {
        console.log('\n✅ RESPONSE:');
        console.log('-'.repeat(50));
        console.log(this.formatMessage(debugInfo.response));
      }

      if (debugInfo.thinking) {
        console.log('\n🧠 THINKING:');
        console.log('-'.repeat(50));
        console.log(this.formatMessage(debugInfo.thinking));
      }

      // Show key metrics from raw response data
      if (debugInfo.rawResponseData) {
        console.log('\n⏱️  RESPONSE METRICS:');
        console.log('-'.repeat(50));
        if (debugInfo.rawResponseData.eval_count !== undefined) {
          console.log(`Tokens generated: ${debugInfo.rawResponseData.eval_count}`);
        }
        if (debugInfo.rawResponseData.prompt_eval_count !== undefined) {
          console.log(`Prompt tokens: ${debugInfo.rawResponseData.prompt_eval_count}`);
        }
        if (debugInfo.rawResponseData.total_duration !== undefined) {
          const seconds = (debugInfo.rawResponseData.total_duration / 1e9).toFixed(2);
          console.log(`Total duration: ${seconds}s`);
        }
        if (debugInfo.rawResponseData.eval_duration !== undefined) {
          const evalSeconds = (debugInfo.rawResponseData.eval_duration / 1e9).toFixed(2);
          console.log(`Generation duration: ${evalSeconds}s`);
        }
      }
    }

    if (debugInfo.error) {
      console.log('\n❌ ERROR:');
      console.log('-'.repeat(50));
      console.log('Message:', debugInfo.error.message);
      if (debugInfo.error.details && !this.isMinimal) {
        console.log('Details:', JSON.stringify(debugInfo.error.details, null, 2));
      }
    }

    console.log('='.repeat(80) + '\n');
  }

  /**
   * Save debug information to markdown file with text analysis
   */
  static async saveToMarkdown(debugInfo: LLMDebugInfo): Promise<void> {
    if (!this.isEnabled) return;

    this.ensureLogsDirectory(debugInfo.provider);

    const timestamp = debugInfo.timestamp.toISOString().replace(/[:.]/g, '-');

    // Extract and clean use case name
    let useCaseName = 'unknown';
    if (debugInfo.useCase) {
      useCaseName = debugInfo.useCase
        .replace(/UseCase$/i, '')
        .replace(/^Create/i, '')
        .toLowerCase();
    }

    // Add chapter/page identifier to filename
    let chapterPageSuffix = '';
    if (debugInfo.chapterNumber && debugInfo.pageNumber) {
      chapterPageSuffix = `_c${debugInfo.chapterNumber}p${debugInfo.pageNumber}`;
    } else if (debugInfo.chapterNumber) {
      chapterPageSuffix = `_c${debugInfo.chapterNumber}`;
    }

    const filename = `${timestamp}_${useCaseName}${chapterPageSuffix}.md`;
    const logsDir = this.getLogsDir(debugInfo.provider);
    const filePath = path.join(logsDir, filename);

    // Perform text analysis if response is available
    let wordFrequencySection = '';
    let stemFrequencySection = '';

    if (debugInfo.response) {
      const { wordFrequencySection: wordSection, stemFrequencySection: stemSection } =
        TextAnalyzer.generateTextAnalysisMarkdown(debugInfo.response, 50);

      wordFrequencySection = wordSection;
      stemFrequencySection = stemSection;
    }

    const markdownContent = `# LLM Request & Response Log

## Provider Information
- **Provider**: ${debugInfo.provider}
- **Model**: ${debugInfo.model}
- **Base URL**: ${debugInfo.baseUrl}
${debugInfo.temperature !== undefined ? `- **Temperature**: ${debugInfo.temperature}` : ''}
${debugInfo.reasoningEffort ? `- **Reasoning Effort**: ${debugInfo.reasoningEffort}` : ''}

## Request Information
- **Request Timestamp**: ${debugInfo.timestamp.toISOString()}
- **Response Timestamp**: ${debugInfo.responseTimestamp?.toISOString() || 'N/A'}
- **Use Case**: ${debugInfo.useCase || 'Unknown'}
- **Session ID**: ${debugInfo.sessionId}
${debugInfo.chapterNumber || debugInfo.pageNumber || debugInfo.pageName ? `- **Chapter**: ${debugInfo.chapterNumber || 'N/A'}
- **Page**: ${debugInfo.pageNumber || 'N/A'}${debugInfo.pageName ? `
- **Page Name**: ${debugInfo.pageName}` : ''}` : ''}

${debugInfo.clientRequestBody ? `## Client Request Body
\`\`\`json
${JSON.stringify(debugInfo.clientRequestBody, null, 2)}
\`\`\`
` : ''}

## System Message
\`\`\`
${debugInfo.systemMessage}
\`\`\`

## User Message
\`\`\`
${debugInfo.userMessage}
\`\`\`

## Complete Request Data
\`\`\`json
${JSON.stringify(debugInfo.requestData, null, 2)}
\`\`\`

${debugInfo.response ? `## Response
\`\`\`
${debugInfo.response}
\`\`\`
` : ''}

${debugInfo.rawResponseData ? `## Complete Response Data
\`\`\`json
${JSON.stringify(debugInfo.rawResponseData, null, 2)}
\`\`\`
` : ''}

${wordFrequencySection}

${stemFrequencySection}

${debugInfo.thinking ? `## Thinking
\`\`\`
${debugInfo.thinking}
\`\`\`
` : ''}

${debugInfo.error ? `## Error
- **Message**: ${debugInfo.error.message}
${debugInfo.error.details ? `\`\`\`json
${JSON.stringify(debugInfo.error.details, null, 2)}
\`\`\`
` : ''}` : ''}

---
*Generated on ${new Date().toISOString()}*
`;

    try {
      await fs.promises.writeFile(filePath, markdownContent, 'utf8');
      console.log(`📝 Log saved to: ${filePath}`);
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  }

  // API methods for easy usage
  static async logRequest(debugInfo: LLMDebugInfo): Promise<void> {
    this.logRequestToConsole(debugInfo);
  }

  static async logResponse(debugInfo: LLMDebugInfo): Promise<void> {
    if (this.showResponseInConsole) {
      this.logResponseToConsole(debugInfo);
    }
    await this.saveToMarkdown(debugInfo);
  }

  static async logError(debugInfo: LLMDebugInfo): Promise<void> {
    // Always show errors in console, regardless of response console setting
    this.logResponseToConsole(debugInfo);
    await this.saveToMarkdown(debugInfo);
  }
}

// Re-export LLMDebugInfo from types for convenience
export type { LLMDebugInfo };

// Backward compatibility: Export as OllamaDebugger and OllamaDebugInfo
export { LLMDebugger as OllamaDebugger };
export type { LLMDebugInfo as OllamaDebugInfo };
