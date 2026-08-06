import axios from 'axios';
import { MiniMaxProvider } from '../../../../../src/middleware/services/llm/providers/minimax-provider';
import { ThinkingExtractorFactory } from '../../../../../src/middleware/services/llm/thinking';
import { logger } from '../../../../../src/middleware/shared/utils/logging.utils';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock LLMDebugger to avoid file system operations
jest.mock('../../../../../src/middleware/services/llm/utils/debug-llm.utils', () => ({
  LLMDebugger: {
    logRequest: jest.fn().mockResolvedValue(undefined),
    logResponse: jest.fn().mockResolvedValue(undefined),
    logError: jest.fn().mockResolvedValue(undefined)
  }
}));

const MODEL = 'MiniMax-M3';
const DEFAULT_BASE_URL = 'https://api.minimax.io/v1';

/**
 * Minimal valid MiniMax (OpenAI-compatible) Chat Completions response.
 *
 * The shapes below are taken from a live probe against MiniMax-M3, not
 * invented: `message` carries only `role` and `content`, the reasoning sits
 * INLINE as a `<think>` block, `reasoning_tokens` lives under
 * `completion_tokens_details` and `cached_tokens` under `prompt_tokens_details`.
 */
const baseResponse = (overrides: Record<string, unknown> = {}) => ({
  status: 200,
  data: {
    id: 'chatcmpl-abc',
    object: 'chat.completion',
    created: 1700000000,
    model: MODEL,
    choices: [
      { index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }
    ],
    usage: {
      prompt_tokens: 183,
      completion_tokens: 14,
      total_tokens: 197,
      total_characters: 0,
      completion_tokens_details: { reasoning_tokens: 12 },
      prompt_tokens_details: { cached_tokens: 128 }
    },
    ...overrides
  }
});

describe('MiniMaxProvider', () => {
  let provider: MiniMaxProvider;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Isolate unit tests from any real .env values so behavior is deterministic
    delete process.env.MINIMAX_API_KEY;
    delete process.env.MINIMAX_BASE_URL;
    delete process.env.MINIMAX_MODEL;
    provider = new MiniMaxProvider();
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  const call = (opts: Record<string, unknown> = {}) =>
    provider.callWithSystemMessage('Hi', 'You are helpful.', { authToken: 'k', ...opts } as never);

  describe('Anfrage', () => {
    it('spricht den OpenAI-kompatiblen Endpunkt mit Bearer-Auth an', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse());
      await call();
      const [url, , config] = mockedAxios.post.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
      expect(url).toBe(`${DEFAULT_BASE_URL}/chat/completions`);
      expect(config.headers.Authorization).toBe('Bearer k');
    });

    it('🚨 sendet KEIN reasoning_effort und KEIN response_format', async () => {
      // Live verifiziert: MiniMax nimmt beide mit HTTP 200 an und denkt
      // trotzdem. Sie zu senden wäre ein Versprechen, das das Modell nicht
      // hält — und `json_object` widerspräche einem Prompt, der ein Array will.
      mockedAxios.post.mockResolvedValue(baseResponse());
      await call();
      const [, body] = mockedAxios.post.mock.calls[0] as [string, Record<string, unknown>];
      expect(body).not.toHaveProperty('reasoning_effort');
      expect(body).not.toHaveProperty('response_format');
    });

    it('meldet einen angeforderten reasoningEffort als wirkungslos, statt ihn zu schlucken', async () => {
      // Ein still verworfener Wunsch wäre nicht von einem erfüllten zu
      // unterscheiden.
      mockedAxios.post.mockResolvedValue(baseResponse());
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as never);
      await call({ reasoningEffort: 'none' });
      expect(warn).toHaveBeenCalled();
      expect(String(warn.mock.calls[0]![0])).toContain('reasoningEffort');
      warn.mockRestore();
    });

    it('nimmt Basis-URL und Modell aus der Umgebung', async () => {
      process.env.MINIMAX_BASE_URL = 'https://eigener.host/v1/';
      process.env.MINIMAX_MODEL = 'MiniMax-Text-01';
      mockedAxios.post.mockResolvedValue(baseResponse());
      await call();
      const [url, body] = mockedAxios.post.mock.calls[0] as [string, Record<string, unknown>];
      // Der abschliessende Schrägstrich darf keine doppelte Trennung erzeugen.
      expect(url).toBe('https://eigener.host/v1/chat/completions');
      expect(body.model).toBe('MiniMax-Text-01');
    });

    it('verlangt einen Schlüssel — und sagt welchen', async () => {
      await expect(
        provider.callWithSystemMessage('Hi', 'Sys', {} as never),
      ).rejects.toThrow(/MINIMAX_API_KEY/);
    });
  });

  describe('🚨 Thinking kommt inline und wird herausgelöst', () => {
    it('trennt den <think>-Block vom Inhalt', async () => {
      // Genau die Form, die die Live-Sonde zurückgab.
      mockedAxios.post.mockResolvedValue(baseResponse({
        choices: [{ index: 0, message: { role: 'assistant', content: '<think>Der Nutzer will OK.</think>\n\nOK' }, finish_reason: 'stop' }]
      }));
      const r = await call();
      expect(r!.message.content).toBe('OK');
      expect(r!.message.thinking).toContain('Der Nutzer will OK');
    });

    it('lässt einen Inhalt ohne Block unverändert', async () => {
      // Gegenprobe: ohne sie wäre auch eine Fassung grün, die IMMER schneidet.
      mockedAxios.post.mockResolvedValue(baseResponse());
      const r = await call();
      expect(r!.message.content).toBe('Hello!');
      expect(r!.message.thinking).toBeUndefined();
    });

    it('meldet es, wenn NUR gedacht und nicht geantwortet wurde', async () => {
      // Ein leerer Inhalt ohne Grund wäre von „nichts zu sagen" nicht zu
      // unterscheiden — hier hat das Denken das Ausgabebudget verbraucht.
      mockedAxios.post.mockResolvedValue(baseResponse({
        choices: [{ index: 0, message: { role: 'assistant', content: '<think>Ich überlege noch…</think>' }, finish_reason: 'length' }]
      }));
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined as never);
      const r = await call();
      expect(r!.message.content).toBe('');
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('der Extractor wird für MiniMax überhaupt gewählt', async () => {
      // Ohne diesen Eintrag in der Factory griffe der NoOp-Extractor, und das
      // Denken landete in jeder Antwort. Die Zusicherung gehört hierher, weil
      // sie die Voraussetzung der drei Tests darüber ist.
      expect(ThinkingExtractorFactory.usesThinkingTags('MiniMax-M3')).toBe(true);
      expect(ThinkingExtractorFactory.usesThinkingTags('minimax-text-01')).toBe(true);
      // Und nicht pauschal für alles:
      expect(ThinkingExtractorFactory.usesThinkingTags('llama3:8b')).toBe(false);
    });
  });

  describe('Token', () => {
    it('bildet reasoning_tokens und cached_tokens ab', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse());
      const r = await call();
      expect(r!.usage).toMatchObject({
        inputTokens: 183,
        outputTokens: 14,
        totalTokens: 197,
        reasoningTokens: 12,
        cacheMetadata: { cacheReadTokens: 128 },
      });
    });

    it('kommt ohne usage-Block zurecht', async () => {
      mockedAxios.post.mockResolvedValue(baseResponse({ usage: undefined }));
      const r = await call();
      expect(r!.usage).toMatchObject({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
      expect(r!.usage).not.toHaveProperty('reasoningTokens');
    });
  });

  describe('Fehler', () => {
    it('gibt bei HTTP-Fehlern null zurück statt zu werfen', async () => {
      mockedAxios.post.mockRejectedValue(Object.assign(new Error('Payment Required'), {
        isAxiosError: true,
        response: { status: 402, statusText: 'Payment Required', data: {} },
      }));
      const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined as never);
      await expect(call()).resolves.toBeNull();
      // 402 bekommt eine eigene Meldung: leeres Guthaben und erschöpftes
      // Kontingent brauchen verschiedene Reaktionen.
      expect(error.mock.calls.some((c) => String(c[0]).includes('balance'))).toBe(true);
      error.mockRestore();
    });
  });
});
