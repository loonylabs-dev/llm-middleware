# Integration of Requesty.AI Provider

**Status:** Ready for Implementation
**Created:** 2025-12-08
**Branch:** `feature/provider-requesty-ai`
**Estimated Effort:** 4-6 hours (Core: 3-4h, Testing: 1h, Optional: 0.5h, Buffer: 0.5-1h)

---

## Overview

### Problem
Die LLM-Middleware unterstützt aktuell nur 3 Provider (Ollama, Google Gemini, Anthropic). Es kommen ständig neue Modelle und Anbieter auf den Markt. Jede neue Provider-Integration bedeutet Entwicklungsaufwand.

**Konkretes Beispiel:** OpenAI/ChatGPT-Modelle sind nicht verfügbar, weil OpenAI nur in den USA hostet. Für EU-basierte Apps wie Scribomate ist das ein Datenschutzproblem (DSGVO-Konformität).

Requesty.ai löst zwei Probleme gleichzeitig:
1. **EU-Hosting:** Hostet OpenAI-Modelle (ChatGPT) in der EU → DSGVO-konform
2. **Gateway-Funktion:** Ein API-Key für Zugang zu dutzenden Modellen verschiedener Anbieter

### Affected Users
- **Scribomate:** Hauptanwendung, die die Middleware nutzt
- **npm Library-Nutzer:** Externe Entwickler, die llm-middleware als Dependency verwenden
- **Häufigkeit:** Ständig neue Modelle → konfigurativ nutzbar ohne Code-Änderungen in den Apps

### Magic Moment
> **"Endlich kann ich ChatGPT DSGVO-konform in meiner EU-App nutzen!"**
>
> **"Mit einem API-Key habe ich Zugang zu dutzenden Modellen ohne zig Integrationen!"**

Beide Aspekte zusammen machen den Wow-Moment: EU-konforme Nutzung von ChatGPT + massiv reduzierter Integrationsaufwand für zukünftige Modelle.

### Differentiator
Diese Integration ist nicht einfach "noch ein Provider". Der Differentiator liegt in:
- **Architektur-Konformität:** Saubere Integration gemäß bestehender Patterns (analog zu Ollama/Google/Anthropic)
- **Provider-Agnostizität:** Request/Response-Verarbeitung muss dem etablierten System folgen
- **Qualität:** Nicht "quick & dirty", sondern korrekt nach den Architektur-Vorgaben implementiert

---

## Success Metrics

**Messbarer Erfolg:**
1. ✅ **Erfolgreiche Response:** Ein Modell über requesty.ai aufrufen → `CommonLLMResponse` erhalten
2. ✅ **Error Handling:** Im Fehlerfall `null` + standardisiertes Logging (analog zu Anthropic/Gemini/Ollama)
3. ✅ **Model-Agnostizität:** Jedes von requesty.ai angebotene Modell funktioniert (z.B. `openai/gpt-4o`, `anthropic/claude-3-5-sonnet`)
4. ✅ **Timeout:** 180s für alle Provider (nicht nur requesty.ai)
5. ✅ **Pattern-Konformität:** Integration folgt exakt dem Pattern der bestehenden Provider

**Objektiv verifizierbar:**
- Unit Test mit Mock-Response erfolgreich
- Integration Test mit echtem requesty.ai API-Call erfolgreich
- Scribomate kann requesty.ai-Provider konfigurativ nutzen

---

## Scope

### In Scope (MVP)
✅ **Requesty.ai Provider-Klasse:**
- Neue Datei `src/middleware/services/llm/providers/requesty-provider.ts`
- Extends `BaseLLMProvider`
- Implementiert `callWithSystemMessage()` analog zu AnthropicProvider
- OpenAI-kompatibles Request-Format (`/v1/chat/completions`)
- Response-Mapping zu `CommonLLMResponse`

✅ **Modell-Agnostizität:**
- Alle Modelle funktionieren automatisch durch requesty.ai Gateway
- Model-Format: `provider/model-name` (z.B. `openai/gpt-4o`)
- Keine Provider-spezifische Model-Validierung

✅ **Auth & Config:**
- ENV Variable: `REQUESTY_API_KEY` anlegen
- Base URL: `https://router.requesty.ai/v1`
- Optional Headers: `HTTP-Referer`, `X-Title` für Analytics

✅ **Global Timeout Anpassung:**
- Timeout auf 180s für ALLE Provider (Anthropic, Gemini, Ollama, Requesty)
- Nicht nur für requesty.ai

✅ **Export & Integration:**
- Provider in `src/middleware/services/llm/providers/index.ts` exportieren
- In LLMProvider enum hinzufügen

✅ **Release:**
- Version bump nach Fertigstellung
- npm publish durch User

### Out of Scope (Later)
❌ **Streaming-Unterstützung** (requesty.ai bietet es, aber wir brauchen es nicht)
❌ **Spezielle requesty.ai-Features** (Caching, Failover, etc. - nutzen wir nicht aktiv)
❌ **Cost-Tracking** (requesty.ai bietet es, aber implementieren wir nicht explizit)

---

## Risks & Dependencies

### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAI-Format unterscheidet sich von Anthropic-Pattern | Hoch | Response-Struktur auf `CommonLLMResponse` mappen wie bei anderen Providern; Token-Usage aus OpenAI-Format extrahieren |
| Model-Namen Format `provider/model-name` unklar für User | Mittel | In Code-Kommentaren und Beispielen dokumentieren (z.B. `openai/gpt-4o`) |
| API-Key fehlt zur Testzeit | Niedrig | ENV-Variable `REQUESTY_API_KEY` anlegen, User trägt Secret ein |
| Timeout-Änderung beeinflusst andere Provider | Niedrig | 180s ist großzügig genug; bei Problemen kann user-seitig per options überschrieben werden |

### Dependencies
**Technisch:**
- ✅ Axios (bereits vorhanden in package.json)
- ✅ BaseLLMProvider (bereits vorhanden)
- ✅ CommonLLMResponse Type (bereits vorhanden)
- ✅ Logger Services (bereits vorhanden: logger, dataFlowLogger, LLMDebugger)

**Konfiguration:**
- ✅ Base URL: `https://router.requesty.ai/v1` (bekannt)
- ✅ API Key: User hat bereits einen
- ⚠️ ENV Variable: `REQUESTY_API_KEY` muss angelegt werden

**Dokumentation:**
- ✅ Requesty.ai Doku: https://docs.requesty.ai/quickstart

### Constraints
- **Release-Prozess:** Nach Fertigstellung → Version bump → npm publish
- **Zeitlich:** Keine Deadline
- **Architektur:** MUSS bestehende Patterns folgen (kein "quick & dirty")

---

## Technical Context

### Affected Files
| File | Action | Purpose | Pattern to Follow |
|------|--------|---------|-------------------|
| `src/middleware/services/llm/types/common.types.ts` | MODIFY | LLMProvider enum | Add `REQUESTY = 'requesty'` at line 92 |
| `src/middleware/services/llm/llm.service.ts` | MODIFY | Provider registration | Import RequestyProvider (line 9), register in constructor (line 22) |
| `src/middleware/services/llm/providers/index.ts` | MODIFY | Provider exports | Add `export * from './requesty-provider'` at line 10 |
| `src/middleware/services/llm/types/index.ts` | MODIFY | Type exports | Add `export * from './requesty.types'` at line 8 |
| `src/middleware/services/llm/providers/anthropic-provider.ts` | MODIFY | Timeout (90s→180s) | Change line 174: `timeout: 180000` |
| `src/middleware/services/llm/providers/ollama-provider.ts` | MODIFY | Timeout (90s→180s) | Change lines 178, 356, 378, 396: `timeout: 180000` |
| `src/middleware/services/llm/providers/gemini-provider.ts` | MODIFY | Timeout (90s→180s) | Change line 189: `timeout: 180000` |
| `src/middleware/services/llm/providers/requesty-provider.ts` | CREATE | Requesty provider implementation | Extend BaseLLMProvider, implement callWithSystemMessage() (~350-400 lines) |
| `src/middleware/services/llm/types/requesty.types.ts` | CREATE | Requesty type definitions | RequestyRequestOptions, RequestyAPIRequest, RequestyAPIResponse, RequestyResponse (~120-150 lines) |
| `tests/manual/provider-smoke-test.ts` | MODIFY (optional) | Test coverage | Add requesty test case in switch (lines 27-45) |

**Total Files to MODIFY:** 7
**Total Files to CREATE:** 2

### Existing Patterns to Follow

**1. Provider Class Structure** (Reference: `anthropic-provider.ts:22-30`)
```typescript
export class RequestyProvider extends BaseLLMProvider {
  private dataFlowLogger: DataFlowLoggerService;
  private readonly API_VERSION = 'v1';  // Or specific version
  private readonly BASE_URL = 'https://router.requesty.ai/v1';

  constructor() {
    super(LLMProvider.REQUESTY);
    this.dataFlowLogger = DataFlowLoggerService.getInstance();
  }
}
```

**2. Request/Response Normalization** (Reference: `anthropic-provider.ts:82-93, 203-221`)
- Build provider-specific request payload
- Make axios.post() call with headers
- Map response to `CommonLLMResponse` format
- Normalize token usage to `TokenUsage` type

**3. Error Handling Pattern** (Reference: `anthropic-provider.ts:271-361`)
- Type-safe error extraction from Axios errors
- HTTP status-specific logging (401, 429, 400)
- Return `null` on API errors (don't throw)
- Log to all three loggers: `logger`, `dataFlowLogger`, `LLMDebugger`

**4. Three-Level Logging** (Reference: `anthropic-provider.ts:120-154, 234-246`)
```typescript
// 1. LLMDebugger - markdown file logging
await LLMDebugger.logRequest(debugInfo);

// 2. DataFlowLogger - request tracking
const requestId = this.dataFlowLogger.startRequest(debugContext, context);
this.dataFlowLogger.logLLMRequest(requestData, context, requestId);

// 3. Console logger - structured logging
logger.info('Sending request to Requesty API', { context, metadata });
```

**5. Singleton Export Pattern** (Reference: `anthropic-provider.ts:366-370`)
```typescript
// Export singleton instance
export const requestyProvider = new RequestyProvider();

// Export aliases for backward compatibility
export { RequestyProvider as RequestyService };
export { requestyProvider as requestyService };
```

**6. Type Definitions** (Reference: `anthropic.types.ts:12, 92-98`)
```typescript
// Request options extend common
export interface RequestyRequestOptions extends CommonLLMOptions {
  // Requesty-specific fields (if any)
  httpReferer?: string;  // Optional analytics header
  xTitle?: string;       // Optional analytics header
}

// Response extends common
export interface RequestyResponse extends CommonLLMResponse {
  // Requesty-specific fields
  id?: string;
  // Other fields from OpenAI-compatible response
}
```

### Integration Points
| System | Type | Contract |
|--------|------|----------|
| **BaseLLMProvider** | Abstract Class | `callWithSystemMessage(userPrompt, systemMessage, options): Promise<CommonLLMResponse \| null>` at `base-llm-provider.ts:31-35` |
| **CommonLLMOptions** | Interface | Standard request options at `common.types.ts:8-41` - include model, temperature, maxTokens, authToken, baseUrl, debugContext, sessionId |
| **CommonLLMResponse** | Interface | Standard response format at `common.types.ts:66-83` - include message.content, sessionId, metadata, usage |
| **TokenUsage** | Interface | Token normalization at `common.types.ts:47-61` - inputTokens, outputTokens, totalTokens, cacheMetadata |
| **LLMProvider Enum** | Enum | Provider registry at `common.types.ts:88-93` - add `REQUESTY = 'requesty'` |
| **LLMService** | Orchestrator | Provider registration at `llm.service.ts:12-22` - maintains Map of providers |
| **LLMDebugger** | Utility | Request/Response logging at `debug-llm.utils.ts:302-318` - logs to `logs/llm/requesty/requests/` |
| **DataFlowLogger** | Service | Request tracking at `data-flow-logger.service.ts:72-161` - ring buffer tracking |
| **Axios** | HTTP Client | API calls with timeout - pattern: `axios.post(url, payload, { headers, timeout: 180000 })` |

**Data Flow:** UseCase → BaseAIUseCase → LLMService → RequestyProvider → Axios → Requesty API → Response Mapping → CommonLLMResponse

### Technical Deep-Dive

#### 1. LLMProvider Enum - Add REQUESTY Entry
**File:** `src/middleware/services/llm/types/common.types.ts`
**Lines:** 88-93

**BEFORE:**
```typescript
export enum LLMProvider {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google'
}
```

**AFTER:**
```typescript
export enum LLMProvider {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  REQUESTY = 'requesty'
}
```

---

#### 2. LLMService - Import and Register RequestyProvider
**File:** `src/middleware/services/llm/llm.service.ts`

**BEFORE (Lines 6-10):**
```typescript
import { BaseLLMProvider } from './providers/base-llm-provider';
import { OllamaProvider } from './providers/ollama-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { LLMProvider, CommonLLMOptions, CommonLLMResponse } from './types';
```

**AFTER (Add line 9):**
```typescript
import { BaseLLMProvider } from './providers/base-llm-provider';
import { OllamaProvider } from './providers/ollama-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { RequestyProvider } from './providers/requesty-provider';  // ADD THIS
import { LLMProvider, CommonLLMOptions, CommonLLMResponse } from './types';
```

**BEFORE (Lines 16-22):**
```typescript
constructor() {
  this.providers = new Map();
  // Initialize available providers
  this.providers.set(LLMProvider.OLLAMA, new OllamaProvider());
  this.providers.set(LLMProvider.ANTHROPIC, new AnthropicProvider());
  this.providers.set(LLMProvider.GOOGLE, new GeminiProvider());
}
```

**AFTER (Add line 22):**
```typescript
constructor() {
  this.providers = new Map();
  // Initialize available providers
  this.providers.set(LLMProvider.OLLAMA, new OllamaProvider());
  this.providers.set(LLMProvider.ANTHROPIC, new AnthropicProvider());
  this.providers.set(LLMProvider.GOOGLE, new GeminiProvider());
  this.providers.set(LLMProvider.REQUESTY, new RequestyProvider());  // ADD THIS
}
```

---

#### 3. Provider Index - Export RequestyProvider
**File:** `src/middleware/services/llm/providers/index.ts`
**Lines:** 1-11

**BEFORE:**
```typescript
// Base provider
export * from './base-llm-provider';

// Concrete providers
export * from './ollama-provider';
export * from './anthropic-provider';
export * from './gemini-provider';

// Future providers will be added here:
// export * from './openai-provider';
```

**AFTER:**
```typescript
// Base provider
export * from './base-llm-provider';

// Concrete providers
export * from './ollama-provider';
export * from './anthropic-provider';
export * from './gemini-provider';
export * from './requesty-provider';  // ADD THIS

// Future providers will be added here:
// export * from './openai-provider';
```

---

#### 4. Types Index - Export Requesty Types
**File:** `src/middleware/services/llm/types/index.ts`
**Lines:** 1-8

**BEFORE:**
```typescript
// Common types
export * from './common.types';

// Provider-specific types
export * from './ollama.types';
export * from './anthropic.types';
export * from './gemini.types';
```

**AFTER:**
```typescript
// Common types
export * from './common.types';

// Provider-specific types
export * from './ollama.types';
export * from './anthropic.types';
export * from './gemini.types';
export * from './requesty.types';  // ADD THIS
```

---

#### 5. Global Timeout Changes (90s → 180s)

**File 1:** `src/middleware/services/llm/providers/anthropic-provider.ts`
**Line 174:**
```typescript
// BEFORE:
timeout: 90000 // 90 second timeout

// AFTER:
timeout: 180000 // 180 second timeout
```

**File 2:** `src/middleware/services/llm/providers/ollama-provider.ts`
**Lines:** 178, 356, 378, 396
```typescript
// BEFORE (4 locations):
timeout: 90000

// AFTER (4 locations):
timeout: 180000
```

**File 3:** `src/middleware/services/llm/providers/gemini-provider.ts`
**Line 189:**
```typescript
// BEFORE:
timeout: 90000 // 90 second timeout

// AFTER:
timeout: 180000 // 180 second timeout
```

---

#### 6. ENV Configuration - Add Requesty Variables
**File:** `.env.example`
**After line 20 (Gemini config section):**

**ADD:**
```bash
# Requesty.ai API Configuration (Optional)
REQUESTY_API_KEY=your_requesty_api_key_here          # Your Requesty API key
REQUESTY_MODEL=openai/gpt-4o                         # Default: openai/gpt-4o (format: provider/model-name)
```

---

#### 7. Technical Injection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ ENTRY POINT: UseCase.execute()                                  │
│ File: usecases/base/base-ai.usecase.ts:144-200                 │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Get Provider Selection                                  │
│ Method: getProvider() → returns LLMProvider.REQUESTY           │
│ File: base-ai.usecase.ts:135-137                               │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Call LLMService                                         │
│ Method: llmService.callWithSystemMessage()                      │
│ File: llm.service.ts:56-64                                      │
│ Action: Gets provider instance via this.providers.get()         │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: RequestyProvider.callWithSystemMessage()               │
│ File: providers/requesty-provider.ts (NEW)                     │
│                                                                  │
│ 3a. Extract options (authToken, model, temp, maxTokens)        │
│     - authToken = process.env.REQUESTY_API_KEY                 │
│     - model = process.env.REQUESTY_MODEL || 'openai/gpt-4o'   │
│                                                                  │
│ 3b. Build Headers                                               │
│     - Content-Type: application/json                            │
│     - Authorization: Bearer ${authToken}                        │
│     - HTTP-Referer (optional)                                   │
│     - X-Title (optional)                                        │
│                                                                  │
│ 3c. Build Request Payload (OpenAI format)                      │
│     {                                                            │
│       model: "provider/model-name",                             │
│       messages: [{ role: "user", content: userPrompt }],       │
│       max_tokens: maxTokens,                                    │
│       temperature: temperature,                                 │
│       system: systemMessage  // or in messages array            │
│     }                                                            │
│                                                                  │
│ 3d. Create LLMDebugInfo object                                 │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Logging - Request Phase                                 │
│                                                                  │
│ 4a. LLMDebugger.logRequest(debugInfo)                          │
│     File: utils/debug-llm.utils.ts:302-304                     │
│     Output: logs/llm/requesty/requests/{timestamp}.md          │
│                                                                  │
│ 4b. DataFlowLogger.startRequest()                              │
│     File: data-flow-logger.service.ts:72-90                    │
│     Returns: requestId                                          │
│                                                                  │
│ 4c. DataFlowLogger.logLLMRequest()                             │
│     File: data-flow-logger.service.ts:130-161                  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: API Call                                                │
│ Method: axios.post()                                            │
│ URL: https://router.requesty.ai/v1/chat/completions            │
│ Timeout: 180000ms (180 seconds)                                │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Response Processing                                     │
│                                                                  │
│ 6a. Extract response data (OpenAI format)                      │
│     - response.choices[0].message.content → text               │
│     - response.usage → token counts                             │
│                                                                  │
│ 6b. Normalize TokenUsage                                        │
│     {                                                            │
│       inputTokens: usage.prompt_tokens,                         │
│       outputTokens: usage.completion_tokens,                    │
│       totalTokens: usage.total_tokens                           │
│     }                                                            │
│                                                                  │
│ 6c. Build CommonLLMResponse                                     │
│     {                                                            │
│       message: { content: extractedText },                      │
│       sessionId: sessionId,                                     │
│       metadata: { provider, model, tokensUsed, processingTime },│
│       usage: tokenUsage                                         │
│     }                                                            │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: Logging - Response Phase                                │
│                                                                  │
│ 7a. Update debugInfo with response                             │
│                                                                  │
│ 7b. LLMDebugger.logResponse(debugInfo)                         │
│     File: utils/debug-llm.utils.ts:306-311                     │
│     Includes: text analysis, word frequency                     │
│                                                                  │
│ 7c. DataFlowLogger.logLLMResponse()                            │
│     File: data-flow-logger.service.ts:162+                     │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ RETURN: CommonLLMResponse                                       │
│ Back to: UseCase.execute()                                      │
└─────────────────────────────────────────────────────────────────┘

ERROR PATH (if any step fails):
├─ Catch error
├─ Extract error details (Axios error handling)
├─ Log to all three loggers (logger, dataFlowLogger, LLMDebugger)
├─ Handle specific HTTP codes (401 auth, 429 rate limit, 400 bad request)
└─ Return null
```

---

#### 8. OpenAI-Compatible API Format (Requesty.ai)

**Request Format:**
```typescript
POST https://router.requesty.ai/v1/chat/completions

Headers:
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_REQUESTY_API_KEY",
  "HTTP-Referer": "https://yourapp.com" (optional),
  "X-Title": "Your App Name" (optional)
}

Body:
{
  "model": "openai/gpt-4o",  // Format: provider/model-name
  "messages": [
    { "role": "system", "content": "You are a helpful assistant..." },
    { "role": "user", "content": "User prompt here" }
  ],
  "temperature": 0.7,
  "max_tokens": 4096
}
```

**Response Format:**
```typescript
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "openai/gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Response text here"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 100,
    "total_tokens": 150
  }
}
```

### Technical Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| **API Format** | OpenAI-compatible format (`/v1/chat/completions`) | Requesty.ai is a drop-in replacement for OpenAI; using their native format ensures compatibility and reduces complexity |
| **Model Naming** | `provider/model-name` format (e.g., `openai/gpt-4o`) | Requesty.ai's standard format; allows access to 300+ models across multiple providers |
| **System Message Handling** | Include in `messages` array as `role: "system"` | OpenAI format standard; consistent with OpenAI SDK usage |
| **Auth Mechanism** | `Authorization: Bearer {API_KEY}` header | Standard OAuth2 Bearer token auth; consistent with OpenAI and other modern APIs |
| **Timeout Value** | 180s for ALL providers (not just Requesty) | Requesty is a gateway that may aggregate multiple providers; 180s provides buffer for multi-hop latency; also benefits other providers |
| **Optional Headers** | `HTTP-Referer` and `X-Title` as optional | Requesty uses these for analytics; optional to not break existing code; can be added later per use-case |
| **Error Handling** | Return `null` on errors (consistent with other providers) | Maintains consistency with existing provider contract; calling code already handles null returns |
| **Token Usage Mapping** | Map OpenAI `prompt_tokens`/`completion_tokens` to `inputTokens`/`outputTokens` | Standardizes across all providers; `TokenUsage` interface expects this format |
| **ENV Variables** | `REQUESTY_API_KEY` and `REQUESTY_MODEL` | Consistent with existing pattern (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`); clear separation of concerns |
| **Default Model** | `openai/gpt-4o` | Most popular model; EU-hosted via Requesty; good balance of quality and cost |
| **Base URL** | `https://router.requesty.ai/v1` as constant | Documented in Requesty docs; unlikely to change; hardcoded for simplicity |
| **Test Script** | Optional `test:provider:requesty` in package.json | Nice-to-have for consistency with other providers; not blocking for MVP |

---

## Non-Functional Requirements

### Performance
**Timeout:** 180 seconds (global change for all providers)
- **Rationale:** Requesty.ai is a gateway that may route through multiple providers; additional latency buffer needed
- **Impact:** Applies to Anthropic, Gemini, Ollama, and Requesty providers
- **Trade-off:** Longer wait before timeout, but reduces false negatives for slower model responses

**Response Time:** No specific target beyond timeout
- No additional latency introduced by integration
- Requesty.ai adds minimal routing overhead (~50-100ms based on documentation)
- Actual response time depends on underlying model selected

**No caching at middleware level**
- Requesty.ai handles internal caching/optimization
- Middleware remains stateless

### Security
**API Key Handling:**
- ✅ API key stored in ENV variable (`REQUESTY_API_KEY`)
- ✅ Never logged or exposed in debug output
- ✅ Passed via Authorization header (not URL params)
- ✅ No API key in request body

**DSGVO Compliance (Primary Motivation):**
- ✅ Requesty.ai hosts OpenAI models in EU
- ✅ Enables DSGVO-compliant ChatGPT usage
- ✅ Data processing within EU jurisdiction

**Data Transmission:**
- All requests via HTTPS (TLS 1.2+)
- User prompts and system messages transmitted to Requesty.ai
- Logging includes user prompts (consistent with other providers) - local logs only

**No Sensitive Data Exposure:**
- Error messages don't leak API keys
- HTTP 401 errors logged without exposing credentials
- Debug files saved locally (not transmitted)

### Error Handling
**Configuration Errors (Throw Exception):**
- Missing `REQUESTY_API_KEY` → Throw with clear message including ENV var name
- Missing `model` → Throw with clear message
- Pattern: Same as Anthropic/Gemini providers

**API Errors (Return null + Log):**
- **401 Unauthorized:** Log "Authentication error", include status code
- **429 Rate Limit:** Log "Rate limit exceeded", extract `retry-after` header
- **400 Bad Request:** Log "Bad request", include error details from response body
- **Network/Timeout:** Log error, include request metadata
- **Unknown Errors:** Type-safe error extraction, log with context

**Three-Level Logging (Same as other providers):**
1. **Console Logging:** `logger.info()` / `logger.error()` with structured metadata
2. **Data Flow Logging:** `dataFlowLogger` for request/response tracking
3. **Debug File Logging:** `LLMDebugger` writes markdown files to `logs/llm/requesty/requests/`

**Error Recovery:**
- No automatic retry (consistent with other providers)
- Caller can retry by calling again
- `null` return signals error to caller

**Error Context:**
- Always include: `context` (provider name), `error message`, `metadata` (statusCode, sessionId, model)
- Axios errors: Extract status, statusText, response data
- Generic errors: Type-safe error message extraction

### Accessibility
**Not Applicable** - This is a backend API integration with no user-facing UI components. Accessibility concerns (keyboard navigation, screen readers) are handled by consuming applications (e.g., Scribomate).

---

## Acceptance Criteria

### AC-1: Successful API Call with Requesty Provider

**Given:**
- `REQUESTY_API_KEY` is set in .env
- `REQUESTY_MODEL` is set to `openai/gpt-4o` (or any valid model)
- RequestyProvider is registered in LLMService

**When:**
- A use-case calls `llmService.callWithSystemMessage()` with `provider: LLMProvider.REQUESTY`
- System message: "You are a helpful assistant"
- User prompt: "Hello, who are you?"

**Then:**
- API call succeeds (HTTP 200)
- Response is returned as `CommonLLMResponse` with:
  - `message.content` contains text response
  - `sessionId` is set
  - `metadata.provider` === `'requesty'`
  - `metadata.model` === requested model
  - `usage.inputTokens` > 0
  - `usage.outputTokens` > 0
  - `usage.totalTokens` === inputTokens + outputTokens

**Test:**
```bash
# Manual test via smoke test script
REQUESTY_API_KEY=<your-key> REQUESTY_MODEL=openai/gpt-4o npm run test:provider:requesty

# Or via TypeScript test
const response = await llmService.callWithSystemMessage(
  "Hello, who are you?",
  "You are a helpful assistant",
  { provider: LLMProvider.REQUESTY, model: "openai/gpt-4o" }
);
assert(response !== null);
assert(response.message.content.length > 0);
assert(response.usage.totalTokens > 0);
```

**Edge Cases:**
- **Empty user prompt:** Should still succeed with minimal response
- **Very long prompt (>10k tokens):** Should succeed or fail gracefully with 400
- **Unicode/emoji in prompt:** Should be handled correctly by OpenAI format

---

### AC-2: Error Handling - Missing API Key

**Given:**
- `REQUESTY_API_KEY` is NOT set in .env (or empty)
- RequestyProvider is instantiated

**When:**
- A use-case calls `llmService.callWithSystemMessage()` with `provider: LLMProvider.REQUESTY`

**Then:**
- Exception is thrown with message:
  - Contains "Requesty API key is required"
  - Contains "REQUESTY_API_KEY"
  - Mentions .env file or options parameter

**Test:**
```typescript
delete process.env.REQUESTY_API_KEY;
try {
  await llmService.callWithSystemMessage(
    "test",
    "test",
    { provider: LLMProvider.REQUESTY, model: "openai/gpt-4o" }
  );
  fail("Should have thrown");
} catch (error) {
  assert(error.message.includes("REQUESTY_API_KEY"));
  assert(error.message.includes("required"));
}
```

**Edge Cases:**
- **Empty string API key:** Treated same as missing
- **Whitespace-only API key:** Should be caught and thrown

---

### AC-3: Error Handling - Invalid API Key (401)

**Given:**
- `REQUESTY_API_KEY` is set to an invalid value (e.g., "invalid-key")
- RequestyProvider is configured

**When:**
- A use-case makes an API call with the invalid key

**Then:**
- API returns HTTP 401
- RequestyProvider returns `null`
- Error is logged to all three loggers:
  - Console logger: "Authentication error with Requesty API"
  - DataFlowLogger: logs error in response
  - LLMDebugger: creates markdown error file in `logs/llm/requesty/requests/`
- Error log includes: statusCode: 401, context: "RequestyProvider"

**Test:**
```bash
REQUESTY_API_KEY=invalid-key npm run test:provider:requesty
# Should log 401 error and return null
```

**Edge Cases:**
- **Expired API key:** Same handling as invalid key
- **API key for different service:** Same 401 handling

---

### AC-4: Error Handling - Rate Limiting (429)

**Given:**
- Valid `REQUESTY_API_KEY`
- Rate limit has been exceeded

**When:**
- API call is made and Requesty returns HTTP 429

**Then:**
- RequestyProvider returns `null`
- Error is logged with:
  - Message: "Rate limit exceeded"
  - Status code: 429
  - `retry-after` header value (if present)
- All three loggers receive error

**Test:**
```typescript
// Mock axios to return 429
mock.onPost().reply(429, { error: "Too many requests" }, { 'retry-after': '60' });
const response = await requestyProvider.callWithSystemMessage("test", "test", options);
assert(response === null);
// Check logs for "Rate limit exceeded" and retry-after: 60
```

**Edge Cases:**
- **No retry-after header:** Still logs 429, but without retry info
- **Multiple concurrent requests hitting rate limit:** All return null

---

### AC-5: Error Handling - Bad Request (400)

**Given:**
- Valid `REQUESTY_API_KEY`
- Invalid request payload (e.g., unsupported model format)

**When:**
- API call with invalid payload is made

**Then:**
- Requesty returns HTTP 400
- RequestyProvider returns `null`
- Error logged with:
  - Message: "Bad request to Requesty API"
  - Error details from response body
  - Status code: 400

**Test:**
```typescript
const response = await llmService.callWithSystemMessage(
  "test",
  "test",
  { provider: LLMProvider.REQUESTY, model: "invalid/format/model" }
);
assert(response === null);
// Check logs for 400 and error details
```

**Edge Cases:**
- **Missing required field in payload:** 400 with specific field error
- **Invalid temperature value:** 400 with validation error

---

### AC-6: Model Agnosticity - Multiple Models Work

**Given:**
- Valid `REQUESTY_API_KEY`
- Multiple models available via Requesty (e.g., `openai/gpt-4o`, `anthropic/claude-3-5-sonnet`, `google/gemini-pro`)

**When:**
- Use-case makes calls with different `model` options

**Then:**
- All calls succeed (HTTP 200)
- Each returns valid `CommonLLMResponse`
- `metadata.model` reflects the requested model
- No model-specific validation in RequestyProvider code

**Test:**
```typescript
const models = ["openai/gpt-4o", "anthropic/claude-3-5-sonnet", "google/gemini-pro"];
for (const model of models) {
  const response = await llmService.callWithSystemMessage(
    "Say hello",
    "Be brief",
    { provider: LLMProvider.REQUESTY, model }
  );
  assert(response !== null);
  assert(response.metadata.model === model);
}
```

**Edge Cases:**
- **Non-existent model:** Requesty returns 400, middleware returns null
- **Model name typo:** Same as non-existent

---

### AC-7: Timeout Configuration - 180s for All Providers

**Given:**
- All provider files (Anthropic, Gemini, Ollama, Requesty) have been modified

**When:**
- Code inspection or grep for timeout values

**Then:**
- All axios.post() calls have `timeout: 180000` (180 seconds)
- No `timeout: 90000` remains in any provider file
- Locations verified:
  - `anthropic-provider.ts:174`
  - `ollama-provider.ts:178, 356, 378, 396`
  - `gemini-provider.ts:189`
  - `requesty-provider.ts` (new file)

**Test:**
```bash
# Grep for old timeout value - should return 0 results
grep -r "timeout: 90000" src/middleware/services/llm/providers/
# Expected: no results

# Grep for new timeout value - should return 6+ results
grep -r "timeout: 180000" src/middleware/services/llm/providers/
# Expected: 6 results (or more with requesty)
```

**Edge Cases:**
- **Comments mentioning 90:** Not counted as timeout config
- **Test files with 90s timeouts:** Out of scope (only production code)

---

### AC-8: Provider Registration - LLMProvider Enum and Service

**Given:**
- Code changes applied to enum and service

**When:**
- Inspect `common.types.ts` and `llm.service.ts`

**Then:**
- `LLMProvider` enum contains `REQUESTY = 'requesty'`
- `LLMService` constructor registers: `this.providers.set(LLMProvider.REQUESTY, new RequestyProvider())`
- `llm.service.ts` imports `RequestyProvider` from `'./providers/requesty-provider'`

**Test:**
```typescript
import { LLMProvider } from './types/common.types';
import { LLMService } from './llm.service';

assert(LLMProvider.REQUESTY === 'requesty');

const service = new LLMService();
const provider = service.getProvider(LLMProvider.REQUESTY);
assert(provider !== undefined);
assert(provider.getProviderName() === LLMProvider.REQUESTY);
```

**Edge Cases:**
- **Enum value typo:** TypeScript compile error
- **Missing import:** TypeScript compile error

---

### AC-9: Export Pattern - Singleton and Aliases

**Given:**
- `requesty-provider.ts` is created

**When:**
- File is inspected for exports

**Then:**
- Exports singleton instance: `export const requestyProvider = new RequestyProvider()`
- Exports class: `export { RequestyProvider }`
- Exports aliases:
  - `export { RequestyProvider as RequestyService }`
  - `export { requestyProvider as requestyService }`

**Test:**
```typescript
import {
  RequestyProvider,
  requestyProvider,
  RequestyService,
  requestyService
} from './providers/requesty-provider';

assert(requestyProvider instanceof RequestyProvider);
assert(RequestyService === RequestyProvider);
assert(requestyService === requestyProvider);
```

**Edge Cases:**
- **Missing alias:** Breaks backward compatibility, but not critical for MVP

---

### AC-10: Logging Integration - Three-Level Logging

**Given:**
- RequestyProvider makes an API call (success or error)

**When:**
- Call completes

**Then:**
- **Console Logger:** Called with appropriate log level (info/error)
- **DataFlowLogger:**
  - `startRequest()` called before API call
  - `logLLMRequest()` called with request data
  - `logLLMResponse()` called with response/error data
- **LLMDebugger:**
  - `logRequest()` called before API call
  - `logResponse()` or `logError()` called after
  - Markdown file created in `logs/llm/requesty/requests/{timestamp}.md`

**Test:**
```bash
# Run smoke test and check logs
REQUESTY_API_KEY=<key> npm run test:provider:requesty

# Verify log files exist
ls logs/llm/requesty/requests/
# Should show .md files with timestamps

# Check file contains request and response
cat logs/llm/requesty/requests/latest.md
# Should include: model, prompt, response, token usage
```

**Edge Cases:**
- **Logging disabled via env var:** Still creates debug files (check DEBUG_LLM_REQUESTS)
- **File write permission error:** Should not crash provider, log to console

---

### AC-11: Token Usage Normalization

**Given:**
- Requesty API returns OpenAI-format token usage:
  ```json
  {
    "usage": {
      "prompt_tokens": 50,
      "completion_tokens": 100,
      "total_tokens": 150
    }
  }
  ```

**When:**
- Response is mapped to `CommonLLMResponse`

**Then:**
- `usage` field contains:
  ```typescript
  {
    inputTokens: 50,
    outputTokens: 100,
    totalTokens: 150
  }
  ```
- Naming follows `TokenUsage` interface (not OpenAI naming)

**Test:**
```typescript
const response = await requestyProvider.callWithSystemMessage("test", "test", options);
assert(response.usage.inputTokens === response.usage.totalTokens - response.usage.outputTokens);
assert(response.usage.totalTokens > 0);
// Ensure OpenAI naming is NOT leaked
assert(!('prompt_tokens' in response.usage));
```

**Edge Cases:**
- **Missing usage field in API response:** Set to { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
- **Partial usage data:** Use available fields, default others to 0

---

### AC-12: ENV Configuration Documentation

**Given:**
- `.env.example` file exists

**When:**
- File is inspected

**Then:**
- Contains section after Gemini config:
  ```bash
  # Requesty.ai API Configuration (Optional)
  REQUESTY_API_KEY=your_requesty_api_key_here
  REQUESTY_MODEL=openai/gpt-4o  # Default: openai/gpt-4o (format: provider/model-name)
  ```
- Comments explain format and purpose

**Test:**
```bash
grep -A 2 "Requesty.ai API Configuration" .env.example
# Should show REQUESTY_API_KEY and REQUESTY_MODEL lines
```

**Edge Cases:**
- **Missing .env.example:** Create it with requesty section
- **Wrong section order:** Not critical, but keep consistent with other providers

---

## Edge Cases & Error Scenarios

| Scenario | Expected Behavior | Handling |
|----------|-------------------|----------|
| **Empty user prompt** | API call succeeds with minimal response | Pass empty string to Requesty; let API handle it |
| **Very long prompt (>10k tokens)** | Succeeds or fails gracefully with 400 | No token counting in middleware; Requesty returns error if exceeds model limit |
| **Unicode/emoji in prompt** | Handled correctly by OpenAI format | UTF-8 encoding in JSON; no special handling needed |
| **Missing API key (null/undefined)** | Throw exception immediately | Check in callWithSystemMessage before API call |
| **Empty string API key** | Treat same as missing | Validation: `!authToken` catches empty string |
| **Invalid/expired API key** | Return null, log 401 error | HTTP 401 → log + return null |
| **Rate limit exceeded (429)** | Return null, log with retry-after | HTTP 429 → extract retry-after header → log + return null |
| **Bad request (400)** | Return null, log error details | HTTP 400 → extract error body → log + return null |
| **Network timeout (180s)** | Return null, log timeout error | Axios timeout → catch → log + return null |
| **Non-existent model** | Requesty returns 400, middleware returns null | No model validation in middleware; rely on Requesty API |
| **Model name typo** | Same as non-existent model | Pass through to Requesty; 400 response |
| **Invalid temperature value** | Requesty returns 400, middleware returns null | No parameter validation in middleware |
| **Missing max_tokens** | Use default (4096) | Options destructuring provides default |
| **Optional headers (HTTP-Referer, X-Title)** | Not sent if undefined | Only add to headers if provided in options |
| **Missing usage field in response** | Set to {inputTokens: 0, outputTokens: 0, totalTokens: 0} | Fallback in response mapping |
| **Partial usage data** | Use available fields, default others to 0 | Defensive mapping with defaults |
| **Concurrent requests** | All handled independently | Stateless provider; no shared state |
| **Multiple rate limits (429)** | Each returns null independently | No retry logic; each call logs separately |
| **Logging file write permission error** | Log to console, don't crash | Try-catch around LLMDebugger file writes |
| **DEBUG_LLM_REQUESTS disabled** | Still create debug files | LLMDebugger respects env var internally |
| **Missing system message** | Use empty string or omit | Follow OpenAI format; system message optional |
| **Extremely long response (>100k tokens)** | Succeeds, may be slow | No response size limit in middleware |
| **API response missing choices array** | Throw or return null | Defensive access: `response.choices?.[0]?.message?.content` |
| **API response with finish_reason !== "stop"** | Log reason, still return content | OpenAI format may have "length", "content_filter" - still valid |
| **Multiple concurrent providers** | All work independently | Map-based registry; no interference |
| **Provider not registered** | LLMService throws error | `getProvider()` checks Map and throws if missing |
| **Wrong enum value passed** | TypeScript compile error | Type safety prevents invalid provider values |

---

## Implementation

### Tasks

**Task 1: Create Requesty Type Definitions (AC: #8, #11)**
- **Datei:** `src/middleware/services/llm/types/requesty.types.ts` (CREATE NEW)
- **Zeilen:** 1-150 (estimated)
- **Änderung:** Create new file with complete type definitions
  ```typescript
  // NEW FILE: requesty.types.ts
  import { CommonLLMOptions, CommonLLMResponse } from './common.types';

  /**
   * Requesty-specific request options
   * Extends common options with Requesty-specific fields
   */
  export interface RequestyRequestOptions extends CommonLLMOptions {
    httpReferer?: string;  // Optional: Analytics - your site URL
    xTitle?: string;       // Optional: Analytics - your app name
  }

  /**
   * OpenAI-compatible request format for Requesty API
   */
  export interface RequestyAPIRequest {
    model: string;  // Format: provider/model-name (e.g., "openai/gpt-4o")
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
  }

  /**
   * OpenAI-compatible response format from Requesty API
   */
  export interface RequestyAPIResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: Array<{
      index: number;
      message: {
        role: 'assistant';
        content: string;
      };
      finish_reason: 'stop' | 'length' | 'content_filter' | null;
    }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }

  /**
   * Normalized Requesty response (extends CommonLLMResponse)
   */
  export interface RequestyResponse extends CommonLLMResponse {
    id?: string;
    finish_reason?: string;
  }
  ```
- **Dependencies:** None
- **Fulfills:** Type safety for Requesty integration

---

**Task 2: Add REQUESTY to LLMProvider Enum (AC: #8)**
- **Datei:** `src/middleware/services/llm/types/common.types.ts`
- **Zeile:** 88-93
- **Änderung:**
  ```typescript
  // VORHER (Zeile 88-93):
  export enum LLMProvider {
    OLLAMA = 'ollama',
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    GOOGLE = 'google'
  }

  // NACHHER:
  export enum LLMProvider {
    OLLAMA = 'ollama',
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    GOOGLE = 'google',
    REQUESTY = 'requesty'  // ADD THIS LINE
  }
  ```
- **Dependencies:** None
- **Fulfills:** Provider enum registration

---

**Task 3: Create RequestyProvider Implementation (AC: #1, #2, #3, #4, #5, #6, #9, #10, #11)**
- **Datei:** `src/middleware/services/llm/providers/requesty-provider.ts` (CREATE NEW)
- **Zeilen:** 1-400 (estimated)
- **Änderung:** Create complete provider implementation
  ```typescript
  // NEW FILE: requesty-provider.ts
  import axios from 'axios';
  import { v4 as uuidv4 } from 'uuid';
  import { logger } from '../../../shared/utils/logging.utils';
  import { BaseLLMProvider } from './base-llm-provider';
  import { LLMProvider, CommonLLMResponse, TokenUsage } from '../types';
  import {
    RequestyRequestOptions,
    RequestyAPIRequest,
    RequestyAPIResponse,
    RequestyResponse
  } from '../types/requesty.types';
  import { LLMDebugger, LLMDebugInfo } from '../utils/debug-llm.utils';
  import { DataFlowLoggerService } from '../../data-flow-logger';

  /**
   * Requesty.ai provider implementation
   * Provides access to 300+ models via unified OpenAI-compatible API
   * Includes EU-hosted OpenAI models for DSGVO compliance
   */
  export class RequestyProvider extends BaseLLMProvider {
    private dataFlowLogger: DataFlowLoggerService;
    private readonly BASE_URL = 'https://router.requesty.ai/v1';

    constructor() {
      super(LLMProvider.REQUESTY);
      this.dataFlowLogger = DataFlowLoggerService.getInstance();
    }

    /**
     * Call Requesty API with custom system message
     */
    public async callWithSystemMessage(
      userPrompt: string,
      systemMessage: string,
      options: RequestyRequestOptions = {}
    ): Promise<CommonLLMResponse | null> {
      const {
        authToken = process.env.REQUESTY_API_KEY,
        model = process.env.REQUESTY_MODEL || 'openai/gpt-4o',
        temperature = 0.7,
        maxTokens = 4096,
        httpReferer,
        xTitle,
        debugContext,
        sessionId = uuidv4(),
        chapterNumber,
        pageNumber,
        pageName
      } = options;

      // Validate API key
      if (!authToken) {
        throw new Error(
          'Requesty API key is required but not provided. ' +
          'Please set REQUESTY_API_KEY in your .env file or pass authToken in options.'
        );
      }

      // Validate model
      if (!model) {
        throw new Error(
          'Model name is required but not provided. ' +
          'Please set REQUESTY_MODEL in your .env file or pass model in options.'
        );
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      };

      if (httpReferer) headers['HTTP-Referer'] = httpReferer;
      if (xTitle) headers['X-Title'] = xTitle;

      // Build request payload (OpenAI format)
      const requestPayload: RequestyAPIRequest = {
        model: model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: temperature
      };

      // Prepare debug info
      const debugInfo: LLMDebugInfo = {
        timestamp: new Date(),
        provider: this.providerName,
        model: model,
        baseUrl: this.BASE_URL,
        systemMessage: systemMessage,
        userMessage: userPrompt,
        requestData: requestPayload,
        useCase: debugContext,
        sessionId: sessionId,
        chapterNumber: chapterNumber,
        pageNumber: pageNumber,
        pageName: pageName
      };

      // Log request
      await LLMDebugger.logRequest(debugInfo);

      const contextForLogger = {
        currentChapterNr: chapterNumber,
        currentPage: pageNumber,
        debugContext
      };

      const requestId = this.dataFlowLogger.startRequest(
        debugContext || 'requesty-direct',
        contextForLogger
      );

      this.dataFlowLogger.logLLMRequest(
        {
          stage: debugContext || 'requesty-direct',
          prompt: userPrompt,
          systemMessage: systemMessage,
          modelName: model,
          temperature: temperature,
          contextInfo: { sessionId, chapterNumber, pageNumber, pageName }
        },
        contextForLogger,
        requestId
      );

      const requestStartTime = Date.now();

      try {
        logger.info('Sending request to Requesty API', {
          context: 'RequestyProvider',
          metadata: {
            url: `${this.BASE_URL}/chat/completions`,
            model: model,
            promptLength: userPrompt.length,
            maxTokens: maxTokens
          }
        });

        const response = await axios.post<RequestyAPIResponse>(
          `${this.BASE_URL}/chat/completions`,
          requestPayload,
          {
            headers,
            timeout: 180000 // 180 second timeout
          }
        );

        const requestDuration = Date.now() - requestStartTime;

        if (response && response.status === 200) {
          const apiResponse: RequestyAPIResponse = response.data;

          // Extract text from choices
          const responseText = apiResponse.choices[0]?.message?.content || '';

          // Normalize token usage
          const tokenUsage: TokenUsage = {
            inputTokens: apiResponse.usage.prompt_tokens,
            outputTokens: apiResponse.usage.completion_tokens,
            totalTokens: apiResponse.usage.total_tokens
          };

          // Normalize response
          const normalizedResponse: RequestyResponse = {
            message: {
              content: responseText
            },
            sessionId: sessionId,
            metadata: {
              provider: this.providerName,
              model: apiResponse.model,
              tokensUsed: tokenUsage.totalTokens,
              processingTime: requestDuration
            },
            usage: tokenUsage,
            id: apiResponse.id,
            finish_reason: apiResponse.choices[0]?.finish_reason || undefined
          };

          // Update debug info
          debugInfo.responseTimestamp = new Date();
          debugInfo.response = responseText;
          debugInfo.rawResponseData = apiResponse;

          // Log response
          await LLMDebugger.logResponse(debugInfo);

          this.dataFlowLogger.logLLMResponse(
            debugContext || 'requesty-direct',
            {
              rawResponse: responseText,
              processingTime: requestDuration
            },
            contextForLogger,
            requestId
          );

          return normalizedResponse;
        } else {
          const error = new Error(`Status ${response?.status || 'unknown'}`);
          logger.error('Error calling Requesty API', {
            context: this.constructor.name,
            error: error.message,
            metadata: response?.data || {}
          });

          this.dataFlowLogger.logLLMResponse(
            debugContext || 'requesty-direct',
            {
              rawResponse: '',
              processingTime: Date.now() - requestStartTime,
              error
            },
            contextForLogger,
            requestId
          );

          return null;
        }
      } catch (error: unknown) {
        let errorMessage = 'Unknown error';
        let errorDetails: Record<string, any> = {};

        if (error instanceof Error) {
          errorMessage = error.message;
        }

        // Handle Axios errors
        if (
          error &&
          typeof error === 'object' &&
          'isAxiosError' in error &&
          error.isAxiosError === true
        ) {
          const axiosError = error as any;

          if (axiosError.response) {
            errorDetails = {
              statusCode: axiosError.response.status,
              statusText: axiosError.response.statusText,
              data: axiosError.response.data
            };

            // Handle specific HTTP status codes
            if (axiosError.response.status === 401) {
              logger.error('Authentication error with Requesty API', {
                context: this.constructor.name,
                error: 'Invalid API key',
                metadata: {
                  statusCode: axiosError.response.status,
                  message: axiosError.response.data?.error?.message
                }
              });
            } else if (axiosError.response.status === 429) {
              logger.error('Rate limit exceeded', {
                context: this.constructor.name,
                error: 'Too many requests',
                metadata: {
                  statusCode: axiosError.response.status,
                  retryAfter: axiosError.response.headers['retry-after']
                }
              });
            } else if (axiosError.response.status === 400) {
              logger.error('Bad request to Requesty API', {
                context: this.constructor.name,
                error: axiosError.response.data?.error?.message || 'Invalid request',
                metadata: {
                  type: axiosError.response.data?.error?.type,
                  details: axiosError.response.data?.error
                }
              });
            }
          }
        }

        logger.error('Error in API request', {
          context: this.constructor.name,
          error: errorMessage,
          metadata: {
            ...errorDetails,
            requestModel: model,
            sessionId: sessionId
          }
        });

        this.dataFlowLogger.logLLMResponse(
          debugContext || 'requesty-direct',
          {
            rawResponse: '',
            processingTime: Date.now() - requestStartTime,
            error: error instanceof Error ? error : new Error(errorMessage)
          },
          contextForLogger,
          requestId
        );

        debugInfo.responseTimestamp = new Date();
        debugInfo.error = {
          message: errorMessage,
          details: errorDetails
        };

        await LLMDebugger.logError(debugInfo);

        return null;
      }
    }
  }

  // Export singleton instance
  export const requestyProvider = new RequestyProvider();

  // Export aliases for backward compatibility
  export { RequestyProvider as RequestyService };
  export { requestyProvider as requestyService };
  ```
- **Dependencies:** Task 1 (types must exist)
- **Fulfills:** Core provider implementation with all error handling and logging

---

**Task 4: Export Requesty Types (AC: #8)**
- **Datei:** `src/middleware/services/llm/types/index.ts`
- **Zeile:** 7-8
- **Änderung:**
  ```typescript
  // VORHER (Zeile 1-7):
  // Common types
  export * from './common.types';

  // Provider-specific types
  export * from './ollama.types';
  export * from './anthropic.types';
  export * from './gemini.types';

  // NACHHER (add line 8):
  // Common types
  export * from './common.types';

  // Provider-specific types
  export * from './ollama.types';
  export * from './anthropic.types';
  export * from './gemini.types';
  export * from './requesty.types';  // ADD THIS LINE
  ```
- **Dependencies:** Task 1 (requesty.types.ts must exist)
- **Fulfills:** Type exports

---

**Task 5: Export RequestyProvider (AC: #8, #9)**
- **Datei:** `src/middleware/services/llm/providers/index.ts`
- **Zeile:** 7-8
- **Änderung:**
  ```typescript
  // VORHER (Zeile 1-10):
  // Base provider
  export * from './base-llm-provider';

  // Concrete providers
  export * from './ollama-provider';
  export * from './anthropic-provider';
  export * from './gemini-provider';

  // Future providers will be added here:
  // export * from './openai-provider';

  // NACHHER (add line 8):
  // Base provider
  export * from './base-llm-provider';

  // Concrete providers
  export * from './ollama-provider';
  export * from './anthropic-provider';
  export * from './gemini-provider';
  export * from './requesty-provider';  // ADD THIS LINE

  // Future providers will be added here:
  // export * from './openai-provider';
  ```
- **Dependencies:** Task 3 (requesty-provider.ts must exist)
- **Fulfills:** Provider exports

---

**Task 6: Register RequestyProvider in LLMService (AC: #8)**
- **Datei:** `src/middleware/services/llm/llm.service.ts`
- **Zeile:** 9, 22
- **Änderung:**
  ```typescript
  // VORHER (Zeile 6-10):
  import { BaseLLMProvider } from './providers/base-llm-provider';
  import { OllamaProvider } from './providers/ollama-provider';
  import { AnthropicProvider } from './providers/anthropic-provider';
  import { GeminiProvider } from './providers/gemini-provider';
  import { LLMProvider, CommonLLMOptions, CommonLLMResponse } from './types';

  // NACHHER (add line 9):
  import { BaseLLMProvider } from './providers/base-llm-provider';
  import { OllamaProvider } from './providers/ollama-provider';
  import { AnthropicProvider } from './providers/anthropic-provider';
  import { GeminiProvider } from './providers/gemini-provider';
  import { RequestyProvider } from './providers/requesty-provider';  // ADD THIS
  import { LLMProvider, CommonLLMOptions, CommonLLMResponse } from './types';

  // VORHER (Zeile 16-22):
  constructor() {
    this.providers = new Map();
    // Initialize available providers
    this.providers.set(LLMProvider.OLLAMA, new OllamaProvider());
    this.providers.set(LLMProvider.ANTHROPIC, new AnthropicProvider());
    this.providers.set(LLMProvider.GOOGLE, new GeminiProvider());
  }

  // NACHHER (add line 22):
  constructor() {
    this.providers = new Map();
    // Initialize available providers
    this.providers.set(LLMProvider.OLLAMA, new OllamaProvider());
    this.providers.set(LLMProvider.ANTHROPIC, new AnthropicProvider());
    this.providers.set(LLMProvider.GOOGLE, new GeminiProvider());
    this.providers.set(LLMProvider.REQUESTY, new RequestyProvider());  // ADD THIS
  }
  ```
- **Dependencies:** Task 3 (RequestyProvider must exist)
- **Fulfills:** Service registration

---

**Task 7: Update Timeout in AnthropicProvider (AC: #7)**
- **Datei:** `src/middleware/services/llm/providers/anthropic-provider.ts`
- **Zeile:** 174
- **Änderung:**
  ```typescript
  // VORHER (Zeile 174):
  timeout: 90000 // 90 second timeout

  // NACHHER:
  timeout: 180000 // 180 second timeout
  ```
- **Dependencies:** None (independent task)
- **Fulfills:** Global timeout increase

---

**Task 8: Update Timeouts in OllamaProvider (AC: #7)**
- **Datei:** `src/middleware/services/llm/providers/ollama-provider.ts`
- **Zeilen:** 178, 356, 378, 396
- **Änderung:**
  ```typescript
  // VORHER (4 locations - Lines 178, 356, 378, 396):
  timeout: 90000

  // NACHHER (all 4 locations):
  timeout: 180000
  ```
- **Dependencies:** None (independent task)
- **Fulfills:** Global timeout increase

---

**Task 9: Update Timeout in GeminiProvider (AC: #7)**
- **Datei:** `src/middleware/services/llm/providers/gemini-provider.ts`
- **Zeile:** 189
- **Änderung:**
  ```typescript
  // VORHER (Zeile 189):
  timeout: 90000 // 90 second timeout

  // NACHHER:
  timeout: 180000 // 180 second timeout
  ```
- **Dependencies:** None (independent task)
- **Fulfills:** Global timeout increase

---

**Task 10: Update .env.example with Requesty Config (AC: #12)**
- **Datei:** `.env.example`
- **Zeile:** After line 20 (after Gemini section)
- **Änderung:**
  ```bash
  # VORHER (Zeile 18-21):
  # Google Gemini API Configuration (Optional)
  GEMINI_API_KEY=your_gemini_api_key_here          # Your Google Gemini API key
  GEMINI_MODEL=gemini-1.5-pro                      # Default: gemini-1.5-pro

  # Authentication (Optional)

  # NACHHER (add after line 20):
  # Google Gemini API Configuration (Optional)
  GEMINI_API_KEY=your_gemini_api_key_here          # Your Google Gemini API key
  GEMINI_MODEL=gemini-1.5-pro                      # Default: gemini-1.5-pro

  # Requesty.ai API Configuration (Optional)  # ADD THIS SECTION
  REQUESTY_API_KEY=your_requesty_api_key_here          # Your Requesty API key
  REQUESTY_MODEL=openai/gpt-4o                         # Default: openai/gpt-4o (format: provider/model-name)

  # Authentication (Optional)
  ```
- **Dependencies:** None (independent task)
- **Fulfills:** ENV documentation

---

**Task 11 (OPTIONAL): Add test:provider:requesty Script (AC: #1)**
- **Datei:** `package.json`
- **Zeile:** After line 26 (after test:provider:anthropic)
- **Änderung:**
  ```json
  // VORHER (Line 25-27):
  "test:provider:ollama": "TEST_PROVIDER=ollama ts-node tests/manual/provider-smoke-test.ts",
  "test:provider:anthropic": "TEST_PROVIDER=anthropic ts-node tests/manual/provider-smoke-test.ts",

  // NACHHER (add line 27):
  "test:provider:ollama": "TEST_PROVIDER=ollama ts-node tests/manual/provider-smoke-test.ts",
  "test:provider:anthropic": "TEST_PROVIDER=anthropic ts-node tests/manual/provider-smoke-test.ts",
  "test:provider:requesty": "TEST_PROVIDER=requesty ts-node tests/manual/provider-smoke-test.ts",
  ```
- **Dependencies:** Task 3 (provider must exist)
- **Fulfills:** Test script (optional, nice-to-have)

---

**Task 12 (OPTIONAL): Add Requesty Case to Smoke Test (AC: #1)**
- **Datei:** `tests/manual/provider-smoke-test.ts`
- **Zeile:** Around lines 27-45 (in switch statement)
- **Änderung:**
  ```typescript
  // Add case to switch statement:
  case 'requesty':
    providerEnum = LLMProvider.REQUESTY;
    options = {
      authToken: process.env.REQUESTY_API_KEY,
      model: process.env.REQUESTY_MODEL || 'openai/gpt-4o',
      temperature: 0.7,
      maxTokens: 500
    };
    break;
  ```
- **Dependencies:** Task 3 (provider must exist)
- **Fulfills:** Manual testing capability (optional)

---

### Implementation Sequence

**Phase 1: Foundation (Parallel)**
These tasks can all be done in parallel:
- ✅ Task 1: Create requesty.types.ts
- ✅ Task 2: Add REQUESTY to enum
- ✅ Task 10: Update .env.example

**Phase 2: Provider Implementation (Sequential)**
These depend on Phase 1:
- ⏳ Task 3: Create requesty-provider.ts (depends on Task 1)

**Phase 3: Integration (Sequential)**
These depend on Phase 2:
- ⏳ Task 4: Export types (depends on Task 1)
- ⏳ Task 5: Export provider (depends on Task 3)
- ⏳ Task 6: Register in LLMService (depends on Task 3)

**Phase 4: Global Changes (Parallel)**
These can be done in parallel with other phases:
- ✅ Task 7: Update AnthropicProvider timeout
- ✅ Task 8: Update OllamaProvider timeouts
- ✅ Task 9: Update GeminiProvider timeout

**Phase 5: Optional Testing (After Phase 3)**
- ⏳ Task 11: Add test script (optional)
- ⏳ Task 12: Add smoke test case (optional)

**Critical Path:** Task 1 → Task 3 → Task 6 (Types → Provider → Registration)

**Estimated Effort:**
- Core Tasks (1-10): 3-4 hours
- Optional Tasks (11-12): 30 minutes
- Testing & Verification: 1 hour
- **Total: ~5 hours**

---

## Dev Notes

### Architecture Constraints

**MUST Follow These Patterns:**

1. **Provider Class Structure**
   - MUST extend `BaseLLMProvider`
   - MUST call `super(LLMProvider.REQUESTY)` in constructor
   - MUST implement `callWithSystemMessage()` method
   - MUST return `Promise<CommonLLMResponse | null>`

2. **Error Handling**
   - MUST throw on missing API key or model (configuration errors)
   - MUST return `null` on API errors (401, 429, 400, timeouts)
   - MUST log to all three loggers: console `logger`, `dataFlowLogger`, `LLMDebugger`
   - MUST handle specific HTTP status codes: 401 (auth), 429 (rate limit), 400 (bad request)

3. **Response Normalization**
   - MUST map to `CommonLLMResponse` format
   - MUST normalize token usage: `prompt_tokens` → `inputTokens`, `completion_tokens` → `outputTokens`
   - MUST include `metadata` with provider, model, tokensUsed, processingTime
   - MUST set `sessionId` from options or generate with uuidv4()

4. **Logging Pattern**
   - MUST create `LLMDebugInfo` object before API call
   - MUST call `LLMDebugger.logRequest()` before API call
   - MUST call `DataFlowLogger.startRequest()` and get requestId
   - MUST call `DataFlowLogger.logLLMRequest()` with request data
   - MUST call `LLMDebugger.logResponse()` or `LLMDebugger.logError()` after
   - MUST call `DataFlowLogger.logLLMResponse()` with response/error

5. **Export Pattern**
   - MUST export singleton instance: `export const requestyProvider = new RequestyProvider()`
   - MUST export class: `export { RequestyProvider }`
   - MUST export aliases: `export { RequestyProvider as RequestyService }` and `export { requestyProvider as requestyService }`

**FORBIDDEN:**

- ❌ **DO NOT** validate model names in provider code (model-agnostic by design)
- ❌ **DO NOT** implement retry logic (consistent with other providers)
- ❌ **DO NOT** throw exceptions on API errors (return null instead)
- ❌ **DO NOT** leak provider-specific fields into CommonLLMResponse (use extended interface instead)
- ❌ **DO NOT** use OpenAI naming in normalized response (use `inputTokens`, not `prompt_tokens`)
- ❌ **DO NOT** hardcode timeout values differently per provider (use 180000 everywhere)

**Code Location Rules:**

- Provider implementation: `src/middleware/services/llm/providers/`
- Type definitions: `src/middleware/services/llm/types/`
- Exports must be added to respective `index.ts` files
- NO code in `dist/` (auto-generated)
- NO code in `node_modules/`

### Testing Requirements

**Manual Testing (Required):**

1. **Setup .env file:**
   ```bash
   cp .env.example .env
   # Edit .env and add:
   REQUESTY_API_KEY=<your-actual-key>
   REQUESTY_MODEL=openai/gpt-4o
   ```

2. **Test successful API call:**
   ```bash
   # If smoke test script added (Task 11):
   npm run test:provider:requesty

   # Or via TypeScript REPL:
   npx ts-node
   > const { LLMService, LLMProvider } = require('./src/middleware/services/llm');
   > const service = new LLMService();
   > service.callWithSystemMessage('Hello', 'Be brief', { provider: LLMProvider.REQUESTY, model: 'openai/gpt-4o' })
   >   .then(r => console.log(r));
   ```

   **Expected:** Response with `message.content`, `usage` with token counts, `metadata` with provider='requesty'

3. **Test error handling (invalid key):**
   ```bash
   REQUESTY_API_KEY=invalid-key npm run test:provider:requesty
   ```
   **Expected:** Logs show 401 error, function returns null

4. **Test timeout configuration:**
   ```bash
   # Grep for old timeouts (should return 0 results):
   grep -r "timeout: 90000" src/middleware/services/llm/providers/

   # Grep for new timeouts (should return 6+ results):
   grep -r "timeout: 180000" src/middleware/services/llm/providers/
   ```

5. **Test model agnosticity:**
   ```typescript
   // Try different models:
   const models = ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet', 'google/gemini-pro'];
   for (const model of models) {
     const result = await service.callWithSystemMessage('Hi', 'Brief', {
       provider: LLMProvider.REQUESTY,
       model
     });
     console.log(`${model}: ${result ? 'success' : 'failed'}`);
   }
   ```

6. **Verify logging:**
   ```bash
   # After running test, check logs:
   ls -la logs/llm/requesty/requests/

   # Should show .md files with timestamps
   # Check content:
   cat logs/llm/requesty/requests/<latest-file>.md
   # Should include: request, response, token usage, timing
   ```

**Curl Test (Direct API verification):**
```bash
curl -X POST https://router.requesty.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REQUESTY_API_KEY" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "system", "content": "Be brief"},
      {"role": "user", "content": "Hello"}
    ],
    "max_tokens": 100
  }'
```
**Expected:** JSON response with `choices[0].message.content` and `usage` fields

**Build & Compile Verification:**
```bash
# Ensure TypeScript compiles without errors:
npx tsc --noEmit

# Or run full build:
npm run build

# Expected: No compilation errors
```

**Unit Tests (Nice-to-Have):**

If adding unit tests, create: `tests/unit/services/llm/requesty-provider.test.ts`

Test cases to cover:
- ✅ Constructor initializes correctly
- ✅ Missing API key throws exception
- ✅ Missing model throws exception
- ✅ Successful API call returns CommonLLMResponse
- ✅ 401 error returns null and logs
- ✅ 429 error returns null and logs
- ✅ 400 error returns null and logs
- ✅ Token usage normalization (prompt_tokens → inputTokens)
- ✅ Response includes correct metadata

**Integration Test (Post-Implementation):**

In Scribomate or consuming application:
```typescript
import { LLMService, LLMProvider } from 'llm-middleware';

const service = new LLMService();
const response = await service.callWithSystemMessage(
  'Translate "Hello" to German',
  'You are a translator',
  { provider: LLMProvider.REQUESTY, model: 'openai/gpt-4o' }
);

console.log(response.message.content); // Should be "Hallo"
```

### References

**Key Implementation Files:**

1. **BaseLLMProvider** (Abstract base class)
   - File: `src/middleware/services/llm/providers/base-llm-provider.ts`
   - Lines: 8-64
   - Reference for: Class structure, method signatures, validateConfig pattern

2. **AnthropicProvider** (Best reference implementation)
   - File: `src/middleware/services/llm/providers/anthropic-provider.ts`
   - Lines: 22-370
   - Reference for: Complete provider pattern, error handling, logging, response normalization

3. **GeminiProvider** (Alternative reference)
   - File: `src/middleware/services/llm/providers/gemini-provider.ts`
   - Lines: 23-305
   - Reference for: Similar HTTP-based API integration

4. **CommonLLMResponse Interface**
   - File: `src/middleware/services/llm/types/common.types.ts`
   - Lines: 66-83
   - Reference for: Response structure to return

5. **TokenUsage Interface**
   - File: `src/middleware/services/llm/types/common.types.ts`
   - Lines: 47-61
   - Reference for: Token count normalization

6. **LLMDebugger Utility**
   - File: `src/middleware/services/llm/utils/debug-llm.utils.ts`
   - Lines: 302-318 (logRequest, logResponse, logError methods)
   - Reference for: Logging implementation

7. **DataFlowLoggerService**
   - File: `src/middleware/services/data-flow-logger/data-flow-logger.service.ts`
   - Lines: 72-161
   - Reference for: Request/response flow tracking

**Documentation:**

- Requesty.ai API Docs: https://docs.requesty.ai/quickstart
- OpenAI API Format: https://platform.openai.com/docs/api-reference/chat/create
- Project README: `README.md` (for general middleware usage)

**Similar Implementations to Reference:**

- `anthropic.types.ts` - Example of provider-specific types extending common types
- `anthropic-provider.ts:189-221` - Example of token usage normalization
- `anthropic-provider.ts:297-324` - Example of HTTP status code handling
- `gemini-provider.ts:127-155` - Example of request building and logging setup

**Environment Variables Pattern:**

- All providers follow: `{PROVIDER}_API_KEY` and `{PROVIDER}_MODEL`
- Examples: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_URL`
- Requesty follows: `REQUESTY_API_KEY`, `REQUESTY_MODEL`

**Version Information:**

- Current middleware version: Check `package.json` version field
- After implementation: Bump version (e.g., 2.11.0 → 2.12.0) and run `npm publish`

---

## Quality Checklist

Before implementation, verify:

### Completeness
- [ ] Problem is clear without prior context
- [ ] Magic moment is explicit
- [ ] Scope boundaries are unambiguous
- [ ] All technical decisions are final (no "or" options)

### Technical Accuracy
- [ ] File paths are exact and verified
- [ ] Line numbers are current and verified
- [ ] Patterns match existing codebase
- [ ] Integration points are documented
- [ ] No assumptions about non-existent code

### Implementation Readiness
- [ ] A fresh Claude session can start immediately
- [ ] No questions would need to be asked
- [ ] All dependencies are available
- [ ] Test approach is clear

### Testability
- [ ] Every AC has Given/When/Then format
- [ ] Every AC has a test approach
- [ ] Edge cases have expected behaviors
- [ ] Success can be objectively verified

---

**End of Story**
