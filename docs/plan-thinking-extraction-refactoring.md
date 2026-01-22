# Plan: Thinking Extraction Refactoring

## Status: PENDING IMPLEMENTATION

**Erstellt:** 2026-01-22
**Branch:** `fix/filter-thinking-parts-from-content` (enthält bereits Teil-Fix für Gemini)
**Nächster Branch:** `refactor/thinking-extraction-strategy`

---

## 1. Problemstellung

### 1.1 Aktueller Zustand (vor diesem Refactoring)

Die Thinking-Extraktion ist aktuell **auf zwei Ebenen verteilt**:

1. **Provider-Ebene** (z.B. `GeminiBaseProvider.parseResponse()`):
   - Gemini: `thought:true` Parts werden gefiltert → `message.thinking`
   - Anthropic: Extended Thinking API → `message.thinking`

2. **UseCase-Ebene** (`BaseAIUseCase` → `ResponseProcessor`):
   - Extrahiert `<think>` Tags aus `message.content`
   - Wird für Ollama-Modelle wie DeepSeek R1 verwendet

### 1.2 Das Problem

```
┌─────────────────────────────────────────────────────────────────┐
│ BaseAIUseCase                                                   │
│                                                                 │
│ result = await llmService.call(...)                             │
│ // result.message.thinking = "Gemini Thinking" ← vom Provider   │
│                                                                 │
│ { thinking: extractedThinking } = ResponseProcessor(content)    │
│ // extractedThinking = "DeepSeek <think> content" ← aus Tags    │
│                                                                 │
│ // PROBLEM: Welches Thinking verwenden?                         │
│ // - result.message.thinking wird aktuell IGNORIERT!            │
│ createResult(content, extractedThinking)                        │
└─────────────────────────────────────────────────────────────────┘
```

**Konsequenzen:**
- Gemini-Thinking (`thought:true` Parts) kommt nicht beim Konsumenten an
- Unsaubere Architektur: Thinking-Logik in UseCase statt Provider
- Keine einheitliche Schnittstelle für verschiedene Thinking-Mechanismen

### 1.3 Das Ziel

```
┌─────────────────────────────────────────────────────────────────┐
│ Provider (jeder!)                                               │
│                                                                 │
│ parseResponse() {                                               │
│   // Extrahiert Thinking je nach Mechanismus                    │
│   return {                                                      │
│     message: {                                                  │
│       content: "Sauberer Content ohne Thinking",                │
│       thinking: "Thinking aus beliebiger Quelle"  // EINHEITLICH│
│     }                                                           │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ BaseAIUseCase                                                   │
│                                                                 │
│ result = await llmService.call(...)                             │
│ createResult(result.message.content, result.message.thinking)   │
│ // Fertig! Keine Thinking-Logik hier.                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Architektur-Design

### 2.1 Strategy Pattern: ThinkingExtractor

```typescript
// src/middleware/services/llm/thinking/thinking-extractor.interface.ts

/**
 * Result of thinking extraction from LLM response content.
 */
export interface ThinkingExtractionResult {
  /** Content with thinking removed */
  content: string;
  /** Extracted thinking text (undefined if none found) */
  thinking?: string;
}

/**
 * Strategy interface for extracting thinking/reasoning from LLM responses.
 * Different models use different mechanisms to expose their reasoning.
 */
export interface ThinkingExtractor {
  /**
   * Extract thinking from content.
   * @param content - Raw content from LLM response
   * @returns Content with thinking separated
   */
  extract(content: string): ThinkingExtractionResult;

  /**
   * Human-readable name for logging/debugging.
   */
  readonly name: string;
}
```

### 2.2 Implementierungen

```typescript
// src/middleware/services/llm/thinking/extractors/

// 1. NoOp - für Modelle ohne Thinking
export class NoOpThinkingExtractor implements ThinkingExtractor {
  readonly name = 'noop';
  extract(content: string): ThinkingExtractionResult {
    return { content };
  }
}

// 2. Think-Tags - für DeepSeek R1, etc.
export class ThinkTagExtractor implements ThinkingExtractor {
  readonly name = 'think-tags';

  // Unterstützt: <think>, <thinking>, <reasoning>
  private readonly patterns = [
    /<think>([\s\S]*?)<\/think>/gi,
    /<thinking>([\s\S]*?)<\/thinking>/gi,
    /<reasoning>([\s\S]*?)<\/reasoning>/gi,
  ];

  extract(content: string): ThinkingExtractionResult {
    let thinking = '';
    let cleanContent = content;

    for (const pattern of this.patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        thinking += (thinking ? '\n\n' : '') + match[1].trim();
        cleanContent = cleanContent.replace(match[0], '');
      }
    }

    return {
      content: cleanContent.trim(),
      thinking: thinking || undefined
    };
  }
}

// 3. Gemini Parts - für thought:true (bereits in parseResponse implementiert)
// Diese Logik bleibt in GeminiBaseProvider, da sie API-Response-spezifisch ist

// 4. Anthropic Extended Thinking - analog zu Gemini
// Bleibt in AnthropicProvider
```

### 2.3 Extractor Registry / Factory

```typescript
// src/middleware/services/llm/thinking/thinking-extractor.factory.ts

export class ThinkingExtractorFactory {
  private static extractors: Map<string, ThinkingExtractor> = new Map();

  static {
    // Default extractors
    this.register('noop', new NoOpThinkingExtractor());
    this.register('think-tags', new ThinkTagExtractor());
  }

  static register(name: string, extractor: ThinkingExtractor): void {
    this.extractors.set(name, extractor);
  }

  static get(name: string): ThinkingExtractor {
    return this.extractors.get(name) || this.extractors.get('noop')!;
  }

  /**
   * Get extractor for a specific model.
   * Uses heuristics or explicit mapping.
   */
  static forModel(model: string): ThinkingExtractor {
    const lowerModel = model.toLowerCase();

    // Model-based heuristics
    if (lowerModel.includes('deepseek') || lowerModel.includes('r1')) {
      return this.get('think-tags');
    }

    // Default: no extraction (Provider handles it or model has no thinking)
    return this.get('noop');
  }
}
```

### 2.4 Integration in Provider

```typescript
// Beispiel: OllamaProvider

class OllamaProvider extends BaseLLMProvider {

  protected parseResponse(apiResponse: OllamaResponse, ...): CommonLLMResponse {
    const rawContent = apiResponse.message.content;

    // Model-spezifische Thinking-Extraktion
    const extractor = ThinkingExtractorFactory.forModel(this.currentModel);
    const { content, thinking } = extractor.extract(rawContent);

    return {
      message: {
        content,
        thinking
      },
      // ...
    };
  }
}
```

### 2.5 Übersicht: Wer macht was?

| Provider | Thinking-Quelle | Extractor | Wo implementiert? |
|----------|-----------------|-----------|-------------------|
| **Gemini** | `thought:true` Parts | Native (in parseResponse) | `gemini-base.provider.ts` |
| **Anthropic** | Extended Thinking API | Native (in parseResponse) | `anthropic.provider.ts` |
| **Ollama** | `<think>` Tags im Content | `ThinkTagExtractor` | Via Factory |
| **OpenAI** | - | `NoOpExtractor` | Via Factory |
| **Requesty** | Passthrough | Je nach Backend-Modell | Komplex - siehe unten |

### 2.6 Sonderfall: Requesty

Requesty ist ein Meta-Provider der an verschiedene Backends weiterleitet. Optionen:

1. **Requesty extrahiert selbst** - unwahrscheinlich
2. **Wir erkennen das Backend-Modell** und wenden passenden Extractor an
3. **Requesty liefert bereits sauberes Thinking** - prüfen!

→ **TODO:** Requesty-Verhalten testen und dokumentieren

---

## 3. Implementierungsschritte

### Phase 1: ThinkingExtractor Framework (Foundations)

- [ ] **3.1** Erstelle `src/middleware/services/llm/thinking/` Ordner
- [ ] **3.2** Implementiere `ThinkingExtractor` Interface
- [ ] **3.3** Implementiere `NoOpThinkingExtractor`
- [ ] **3.4** Implementiere `ThinkTagExtractor` (migriere Code aus ResponseProcessor)
- [ ] **3.5** Implementiere `ThinkingExtractorFactory`
- [ ] **3.6** Unit-Tests für alle Extractors

### Phase 2: Provider-Integration

- [ ] **3.7** `OllamaProvider`: Integriere ThinkingExtractor in parseResponse
- [ ] **3.8** `GeminiBaseProvider`: Bereits implementiert (thought:true Filter) - verifizieren
- [ ] **3.9** `AnthropicProvider`: Prüfen ob Extended Thinking korrekt in message.thinking landet
- [ ] **3.10** `RequestyProvider`: Verhalten analysieren und ggf. Extractor integrieren
- [ ] **3.11** Integration-Tests für jeden Provider mit Thinking

### Phase 3: UseCase Cleanup

- [ ] **3.12** `BaseAIUseCase`: Entferne Thinking-Extraktion aus ResponseProcessor-Aufruf
- [ ] **3.13** `BaseAIUseCase`: Verwende direkt `result.message.thinking`
- [ ] **3.14** `ResponseProcessor`: Entferne/deprecate Thinking-Extraktion (oder behalte als Fallback)
- [ ] **3.15** Update Tests

### Phase 4: Dokumentation & Cleanup

- [ ] **3.16** Update `docs/reasoning-control.md`
- [ ] **3.17** Update `CHANGELOG.md`
- [ ] **3.18** Update `CLAUDE.md` mit Architektur-Notizen
- [ ] **3.19** Entferne deprecated Code

---

## 4. Relevante Dateien

### 4.1 Zu erstellende Dateien

```
src/middleware/services/llm/thinking/
├── index.ts                           # Exports
├── thinking-extractor.interface.ts    # Interface
├── thinking-extractor.factory.ts      # Factory mit Registry
└── extractors/
    ├── index.ts
    ├── noop.extractor.ts
    └── think-tag.extractor.ts

tests/unit/services/llm/thinking/
├── think-tag.extractor.test.ts
└── thinking-extractor.factory.test.ts
```

### 4.2 Zu modifizierende Dateien

| Datei | Änderung |
|-------|----------|
| `src/middleware/services/llm/providers/ollama.provider.ts` | Integriere ThinkingExtractor |
| `src/middleware/services/llm/providers/gemini/gemini-base.provider.ts` | Bereits gefixt ✅ |
| `src/middleware/services/llm/providers/anthropic.provider.ts` | Prüfen/anpassen |
| `src/middleware/services/llm/providers/requesty.provider.ts` | Analysieren/anpassen |
| `src/middleware/usecases/base/base-ai.usecase.ts` | Entferne ResponseProcessor-Thinking |
| `src/middleware/services/response-processor.service.ts` | Thinking-Code entfernen/deprecaten |
| `src/middleware/services/llm/types/common.types.ts` | Bereits `thinking?: string` ✅ |

### 4.3 Referenz: Aktueller ResponseProcessor Thinking-Code

```typescript
// In ResponseProcessorService - dieser Code soll in ThinkTagExtractor migriert werden

static extractThinking(response: string): string {
  const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/i);
  return thinkMatch ? thinkMatch[1].trim() : '';
}

static extractContent(response: string): string {
  return response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}
```

---

## 5. Aktueller Stand des Branches

### 5.1 Was bereits implementiert ist

Der Branch `fix/filter-thinking-parts-from-content` enthält:

1. **Gemini thought:true Filtering** ✅
   - `GeminiPart` Type erweitert um `thought` und `thoughtSignature`
   - `parseResponse()` filtert thought:true Parts aus Content
   - `message.thinking` enthält Gemini-Thinking

2. **CommonLLMResponse.message.thinking** ✅
   - Type bereits erweitert

3. **Unit-Tests** ✅
   - `gemini-parse-response.test.ts` (10 Tests)

4. **Integration-Tests** ✅
   - `gemini-thinking-parts.integration.test.ts` (5 Tests, alle grün)

### 5.2 Was NICHT funktioniert

- `BaseAIUseCase` gibt `result.message.thinking` nicht an Konsument weiter
- Ich habe einen Quick-Fix versucht der wieder rückgängig gemacht werden sollte

### 5.3 Rückgängig zu machende Änderung

In `base-ai.usecase.ts` wurde temporär folgender Code hinzugefügt (sollte entfernt werden):

```typescript
// DIESER CODE SOLLTE ENTFERNT WERDEN - unsauber!
const providerThinking = result.message.thinking;
if (providerThinking && extractedThinking) {
  thinking = `${providerThinking}\n\n---\n\n${extractedThinking}`;
} else {
  thinking = providerThinking || extractedThinking || '';
}
```

---

## 6. Test-Strategie

### 6.1 Unit-Tests

```typescript
describe('ThinkTagExtractor', () => {
  it('should extract <think> tags', () => {
    const input = '<think>reasoning here</think>actual content';
    const result = extractor.extract(input);
    expect(result.content).toBe('actual content');
    expect(result.thinking).toBe('reasoning here');
  });

  it('should handle multiple think tags', () => { ... });
  it('should handle nested content', () => { ... });
  it('should return undefined thinking when no tags', () => { ... });
});

describe('ThinkingExtractorFactory', () => {
  it('should return ThinkTagExtractor for deepseek models', () => { ... });
  it('should return NoOpExtractor for unknown models', () => { ... });
});
```

### 6.2 Integration-Tests

```typescript
describe('Ollama Provider with DeepSeek', () => {
  it('should extract thinking from <think> tags', async () => {
    const result = await ollamaProvider.call('test', { model: 'deepseek-r1' });
    expect(result.message.thinking).toContain('reasoning');
    expect(result.message.content).not.toContain('<think>');
  });
});
```

---

## 7. Offene Fragen

1. **Requesty-Verhalten:** Wie handled Requesty Thinking für verschiedene Backend-Modelle?
2. **Konfigurierbarkeit:** Soll der Extractor pro Request überschreibbar sein?
3. **Fallback:** Soll ResponseProcessor als Fallback erhalten bleiben?
4. **Performance:** Ist Regex-Extraktion bei großen Responses performant genug?

---

## 8. Abhängigkeiten

- Keine externen Dependencies nötig
- Interne Abhängigkeit: `CommonLLMResponse` Type (bereits angepasst)

---

## 9. Risiken & Mitigationen

| Risiko | Mitigation |
|--------|------------|
| Breaking Change für Konsumenten | Thinking war vorher nicht zuverlässig verfügbar → eigentlich ein Fix |
| Performance bei großen Responses | Regex ist O(n), sollte OK sein. Bei Bedarf optimieren. |
| Unbekannte Modelle | Factory hat Fallback auf NoOpExtractor |

---

## 10. Verwandte Dokumentation

- `docs/reasoning-control.md` - Reasoning Control Feature Docs
- `CHANGELOG.md` - v2.17.1 Eintrag für Gemini-Fix
- `CLAUDE.md` - Projekt-Kontext

---

## 11. Kommando zum Starten

```bash
# Neuen Branch erstellen basierend auf dem aktuellen Fix-Branch
git checkout fix/filter-thinking-parts-from-content
git checkout -b refactor/thinking-extraction-strategy

# Oder falls der Fix-Branch bereits gemerged wurde:
git checkout main
git pull
git checkout -b refactor/thinking-extraction-strategy
```
