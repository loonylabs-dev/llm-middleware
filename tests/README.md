# LLM Middleware Test Suite

Complete testing documentation for all test categories, from unit tests to end-to-end workflows.

## 📋 Quick Reference

| Test Command | Category | Provider Required | Description |
|-------------|----------|-------------------|-------------|
| `npm run test:unit` | Unit | ❌ No | Jest unit tests (193+ tests) |
| `npm run test:unit:watch` | Unit | ❌ No | Jest watch mode for development |
| `npm run test:unit:coverage` | Unit | ❌ No | Jest with coverage report |
| `npm run test:basic` | Component | ❌ No | Basic middleware services validation |
| `npm run test:integration` | Integration | ❌ No | FlatFormatter system tests |
| `npm run test:integration:parameters` | Integration | ✅ Ollama | Token limiting & parameter config |
| `npm run test:robustness` | Robustness | ❌ No | JSON cleaning & error handling |
| `npm run test:e2e` | E2E | ✅ Ollama | Complete workflow with Ollama API |
| `npm run test:provider:ollama` | Provider | ✅ Ollama | Ollama provider smoke test |
| `npm run test:provider:anthropic` | Provider | ✅ Anthropic | Anthropic provider smoke test |
| `npm run test:manual:smoke` | Manual | ✅ Ollama | Smoke test with real Ollama API |
| `npm run test:manual:verify-params` | Manual | ✅ Ollama | Parameter verification test |
| `npm run test:manual:formatter-demo` | Manual | ❌ No | RequestFormatter demo |
| `npm run test:manual:story-test` | Manual | ✅ Ollama | Story generator use case demo |
| `npm run test:all` | Suite | ❌ No | All automated tests (excludes E2E) |
| `npm run test:ci` | CI/CD | ❌ No | CI-optimized Jest tests |

---

## 🚀 Quick Start

### Prerequisites

1. **Build the middleware first** (required for ALL tests):
   ```bash
   npm run build
   ```

2. **For tests that require a provider** (marked with ✅ above):

   **For Ollama:**
   ```bash
   # Start Ollama server
   ollama serve

   # Set MODEL1_NAME in your .env file
   echo "MODEL1_NAME=phi3:mini" >> .env

   # Pull the model (if not already installed)
   ollama pull phi3:mini
   ```

   **For Anthropic:**
   ```bash
   # Set API key in your .env file
   echo "ANTHROPIC_API_KEY=sk-ant-api03-..." >> .env
   echo "ANTHROPIC_MODEL=claude-3-5-sonnet-20241022" >> .env
   ```

### Run All Tests

```bash
# Run all automated tests (no Ollama required)
npm run test:all

# Run ALL tests including E2E (Ollama required)
npm run test:all && npm run test:e2e
```

---

## 📁 Test Structure

```
/tests
├── /unit              # Jest unit tests (TypeScript)
│   ├── /config        # Configuration validation tests
│   ├── /constants     # JSON formatting constants tests
│   ├── /json-cleaner  # Recipe system unit tests
│   ├── /messages      # Message template tests
│   ├── /services      # Service layer tests
│   ├── /usecases      # Use case tests (BaseAIUseCase, provider selection)
│   └── /utils         # Utility function tests
├── /basic             # Component-level tests (JavaScript)
│   └── test-middleware.js
├── /integration       # Integration tests (JavaScript)
│   ├── test-flat-formatter.js
│   └── test-parameter-limits.js
├── /robustness        # Error handling tests (JavaScript)
│   └── test-json-handling.js
├── /e2e               # End-to-end tests (JavaScript)
│   └── test-workflow.js
├── /manual            # Manual/interactive tests (TypeScript/JavaScript)
│   ├── smoke-test.ts                # Legacy Ollama smoke test
│   ├── provider-smoke-test.ts       # Parametrized provider tests (v2.1+)
│   ├── verify-parameters.js
│   ├── request-formatter-demo.ts
│   └── story-generator-test.ts
└── /utils             # Test helper utilities
    └── test-helpers.js
```

---

## 📊 Test Categories

### 🧪 Unit Tests (`npm run test:unit`)

**Framework**: Jest + ts-jest
**Location**: `tests/unit/`
**Ollama Required**: ❌ No
**Duration**: ~5 seconds

**What's tested**:
- JSON Formatting Constants (25 tests)
- Message Templates (26 tests)
- Model Configuration Validation (6 tests)
- Data Flow Logger (9 tests)
- Request Formatter Service (21 tests)
- Memory Management Utils (4 tests)
- Control Character Diagnostics (11 tests)
- Validation Utils (12 tests)
- JSON Cleaner Recipe System (5 tests)
- BaseAIUseCase Provider Selection (4 tests)
- BaseAIUseCase Model Config Provider Pattern (6 tests) - **New in v2.3.0**
  - Default behavior validation
  - Custom provider override tests
  - Backward compatibility tests
  - Edge cases (validation, error handling)
- BaseAIUseCase Dynamic System Message (7 tests) - **New in v2.11.0**
  - `getSystemMessage()` default behavior (returns static systemMessage)
  - Dynamic override per request
  - Backward compatibility (existing use cases work unchanged)
  - Request data access for customization

**Expected Results**:
```
Test Suites: 14 passed, 14 total
Tests:       131+ passed, 131+ total
Coverage:    70%+ (lines, functions, branches, statements)
```

**Run Commands**:
```bash
npm run test:unit              # Run all unit tests
npm run test:unit:watch        # Watch mode for development
npm run test:unit:coverage     # With coverage report
```

---

### 🔧 Basic Component Tests (`npm run test:basic`)

**File**: `tests/basic/test-middleware.js`
**Ollama Required**: ❌ No
**Duration**: <1 second

**What's tested**:
1. RequestFormatterService - Prompt validation and statistics
2. TokenEstimatorService - Token estimation and text stats
3. ModelParameterManagerService - Parameter merging and validation
4. ResponseProcessorService - Thinking/content extraction
5. JsonCleanerService - JSON repair and cleaning
6. FlatFormatter System - Data formatting and presets

**Expected Results**: All 6 services show ✅ status

**Example Output**:
```
🧪 Testing LLM Middleware Foundation...

1. Testing RequestFormatterService...
   ✅ Prompt validation: true
   ✅ Prompt stats: 58 chars, 8 words

2. Testing TokenEstimatorService...
   ✅ Token estimation: 11 tokens (GPT)
   ...
```

---

### 🚀 Integration Tests

#### FlatFormatter System (`npm run test:integration`)

**File**: `tests/integration/test-flat-formatter.js`
**Ollama Required**: ❌ No
**Duration**: <1 second

**What's tested**:
1. Basic FlatFormatter functionality
2. FormatConfigurator with advanced options
3. Character/Genre/Chapter presets
4. Array slicing functionality
5. LLMContextBuilder integration
6. Error handling and null safety

**Expected Results**: All 7 tests complete successfully

---

#### Parameter Limits (`npm run test:integration:parameters`)

**File**: `tests/integration/test-parameter-limits.js`
**Ollama Required**: ✅ Yes
**Duration**: ~30-60 seconds (5 API calls)

**What's tested**:
- Token limiting via `num_predict` parameter
- Parameter application at use-case level
- Output validation and character counting
- TweetGeneratorUseCase (280 character limit)

**Test Scenarios**:
- 5 different topics
- Character count validation
- Performance metrics
- Success rate calculation

**Expected Results**:
```
📊 TEST SUMMARY
Total Tests: 5
✅ Passed: 5 (100%)
❌ Failed: 0 (0%)

📈 Character Count Statistics:
   Average: 250 characters
   Target Limit: 280 characters

🎉 ALL TESTS PASSED! Parameter limiting works correctly.
```

**Prerequisites**:
- Ollama server running (`ollama serve`)
- MODEL1_NAME configured in `.env`
- Model supports parameter configuration

---

### 🛡️ Robustness Tests (`npm run test:robustness`)

**File**: `tests/robustness/test-json-handling.js`
**Ollama Required**: ❌ No
**Duration**: ~2-3 seconds

**What's tested**:
1. **Malformed JSON Cleaning** (10 scenarios)
   - Missing commas
   - Trailing commas
   - Unescaped quotes
   - Control characters
   - Missing braces
   - Extra text/think tags
   - Multiple JSON objects
   - Complex nested errors

2. **Response Processor** (4 scenarios)
   - Thinking tag extraction
   - Markdown formatting
   - Plain JSON responses
   - Extra text handling

3. **Error Scenarios** (6 extreme cases)
   - Empty responses
   - HTML errors
   - Undefined values
   - Invalid JSON
   - Whitespace-only
   - Function calls in JSON

4. **Control Character Diagnostics** (10 tests)
   - Unescaped newlines/tabs
   - Multiple control chars
   - Nested structures
   - Unicode handling
   - LLM response patterns

5. **Performance Testing**
   - Large JSON processing (>10KB)
   - Processing speed metrics

**Expected Results**:
```
🏆 FINAL ROBUSTNESS REPORT
📋 JSON Cleaning: 80%+ success rate
🔍 Response Processing: 90-100% success rate
💥 Error Handling: 100% graceful handling
⚡ Performance: <50ms for large JSON

🎯 OVERALL ROBUSTNESS: 85-95%
✅ Ready for production use with real AI models
```

---

### 🎯 End-to-End Tests (`npm run test:e2e`)

**File**: `tests/e2e/test-workflow.js`
**Ollama Required**: ✅ Yes
**Duration**: ~10-30 seconds (1 API call)

**What's tested**:
- Complete workflow: Request → UseCase → Ollama → JSON Cleaning → Result
- CharacterGeneratorUseCase implementation
- Context building with FlatFormatter
- Real Ollama API communication
- JSON response processing and repair
- Error handling and logging

**Prerequisites**:
- Ollama server running (`ollama serve`)
- MODEL1_NAME configured in `.env`
- Model pulled and available

**Expected Results**:
```
🧪 End-to-End Workflow Test

Testing complete pipeline from request to parsed result...
   ✅ UseCase initialized
   ✅ Ollama API call successful
   ✅ Response received (150 tokens)
   ✅ JSON extracted and parsed
   ✅ Character object validated

🎉 E2E workflow complete - all components working together!
```

---

### 🔌 Provider Tests (v2.1+)

The provider tests validate individual LLM provider implementations using a unified, parametrized test infrastructure.

#### Ollama Provider Test (`npm run test:provider:ollama`)

**File**: `tests/manual/provider-smoke-test.ts`
**Provider Required**: ✅ Ollama
**Duration**: ~10-15 seconds

**What's tested**:
1. Memory management utilities
2. Data flow logger functionality
3. Ollama provider via LLM Service
4. Real API call with configured model
5. Response validation and metrics
6. Log file generation and verification

**Prerequisites**:
- Ollama server running (`ollama serve`)
- MODEL1_NAME configured in `.env`
- Model pulled and available

**Expected Results**:
```
🚀 Starting Provider Smoke Test
==========================================
Provider: ollama
Model: phi3:mini
Base URL: http://localhost:11434
API Key configured: false
==========================================

📊 Test 1: Memory Management Utils
✅ Memory utils working

📝 Test 2: DataFlowLogger
✅ DataFlowLogger working

🤖 Test 3: ollama Provider via LLM Service
✅ API call successful!
Response length: 45
Request duration: 1234ms

📊 Metadata:
  Provider: ollama
  Model: phi3:mini
  Tokens used: 42
  Processing time: 1234ms

📁 Checking log files...
✅ Enhanced logging features verified!

✨ ALL TESTS PASSED! ✨
```

---

#### Anthropic Provider Test (`npm run test:provider:anthropic`)

**File**: `tests/manual/provider-smoke-test.ts`
**Provider Required**: ✅ Anthropic
**Duration**: ~5-10 seconds

**What's tested**:
1. Memory management utilities
2. Data flow logger functionality
3. Anthropic provider via LLM Service
4. Real API call with Claude model
5. Response validation and metrics
6. Log file generation and verification

**Prerequisites**:
- ANTHROPIC_API_KEY configured in `.env`
- ANTHROPIC_MODEL set (e.g., claude-3-5-sonnet-20241022)
- Valid API key with available credits

**Expected Results**:
```
🚀 Starting Provider Smoke Test
==========================================
Provider: anthropic
Model: claude-3-5-sonnet-20241022
API Key configured: true
==========================================

📊 Test 1: Memory Management Utils
✅ Memory utils working

📝 Test 2: DataFlowLogger
✅ DataFlowLogger working

🤖 Test 3: anthropic Provider via LLM Service
✅ API call successful!
Response length: 42
Request duration: 2345ms

📊 Metadata:
  Provider: anthropic
  Model: claude-3-5-sonnet-20241022
  Tokens used: 50
  Processing time: 2345ms

📁 Checking log files...
✅ Enhanced logging features verified!

✨ ALL TESTS PASSED! ✨
```

**Troubleshooting for Anthropic**:
- Verify your API key is correct in `.env`
- Check your account has sufficient credits
- Ensure the model name is valid (see Anthropic docs)

---

### 🛠️ Manual Tests

#### Smoke Test (`npm run test:manual:smoke`)

**File**: `tests/manual/smoke-test.ts`
**Ollama Required**: ✅ Yes
**Duration**: ~10-15 seconds

**What's tested**:
1. Memory management utilities
2. Control character diagnostics
3. Data flow logger
4. Real Ollama API call
5. Log file verification
6. Enhanced logging features

**Expected Results**: All 4 component checks pass + real API response

---

#### Parameter Verification (`npm run test:manual:verify-params`)

**File**: `tests/manual/verify-parameters.js`
**Ollama Required**: ✅ Yes
**Duration**: ~5-10 seconds

**What it does**:
- Generates ONE tweet
- Shows exact request details
- Verifies parameter passing to Ollama
- Displays expected vs actual parameters
- Provides verification instructions

**Use Case**: Quick check to verify parameters are being passed correctly to Ollama

**Example Output**:
```
🔍 Parameter Verification Test

📝 Topic: "The importance of clean code"
✅ Generation Complete!

📊 RESULT:
Tweet: "Clean code is the foundation of maintainable software..."
Character Count: 267/280
Within Limit: ✓ YES

🔍 EXPECTED PARAMETERS IN REQUEST:
  num_predict: 70
  temperature: 0.7
  repeat_penalty: 1.3
  ...

💡 VERIFICATION STEPS:
1. Check the latest Ollama log file in: logs/ollama/requests/
2. Look for the "options" object in the request JSON
3. Verify that all parameters above are present
```

---

#### Request Formatter Demo (`npm run test:manual:formatter-demo`)

**File**: `tests/manual/request-formatter-demo.ts`
**Ollama Required**: ❌ No
**Duration**: <1 second

**What it demonstrates**:
1. RequestFormatterService with complex prompts
2. FlatFormatter simple usage
3. Different formatting options
4. Context and instruction separation

**Use Case**: Understanding how RequestFormatterService works with different prompt structures

---

#### Story Generator Test (`npm run test:manual:story-test`)

**File**: `tests/manual/story-generator-test.ts`
**Ollama Required**: ✅ Yes
**Duration**: ~30-60 seconds (3 API calls)

**What it demonstrates**:
1. **Simple string prompt**
   - Direct string message
   - Basic story generation

2. **Complex context + instruction**
   - Structured context object
   - Genre, tone, constraints
   - Formatted instruction
   - Context extraction

3. **Nested prompt structure**
   - Nested prompt.prompt structure
   - RequestFormatterService handling

**Use Case**: Complete example of RequestFormatterService in action with real API calls

---

## ⚠️ Common Issues and Solutions

### "Cannot find module './dist/middleware/services'"

**Cause**: Project not built or outdated build
**Solution**:
```bash
npm run build
```

### "ECONNREFUSED 127.0.0.1:11434"

**Cause**: Ollama server not running
**Solution**:
```bash
ollama serve
```

### "Model not found"

**Cause**: MODEL1_NAME not set or model not installed
**Solution**:
```bash
# Set in .env
echo "MODEL1_NAME=phi3:mini" >> .env

# Pull model
ollama pull phi3:mini
```

### Tests fail with "require is not defined"

**Cause**: TypeScript files not compiled
**Solution**:
```bash
npm run build
```

### JSON Cleaning below 70% success rate

**Cause**: Some extreme cases are designed to fail
**Note**: 70-90% success rate is normal and expected

---

## 🔬 Development Workflow

### Before Committing
```bash
npm run build
npm run test:unit          # Fast unit tests
npm run test:all           # All automated tests
```

### Before Releasing
```bash
npm run build
npm run test:unit:coverage # Unit tests with coverage
npm run test:all           # All automated tests
npm run test:e2e           # E2E with Ollama running
npm run test:manual:smoke  # Manual smoke test
```

### Adding New Tests

1. **Create test file** in appropriate directory
2. **Add npm script** to `package.json`
3. **Document in this README**:
   - Add to Quick Reference table
   - Create detailed section
   - Document prerequisites
   - Specify expected results
4. **Update `test:all`** if applicable

---

## 📈 Continuous Integration

For CI/CD pipelines, use:

```bash
npm run test:ci  # Jest with CI optimization
```

This runs unit tests with:
- `--runInBand` (sequential execution)
- `--ci` (optimized for CI environments)
- `--coverage` (generates coverage reports)

**Note**: E2E tests requiring Ollama should be separate CI jobs with Ollama server setup.

---

## 📞 Support

If tests consistently fail:

1. ✅ **Check prerequisites** (Node version, build status, Ollama availability)
2. ✅ **Review test output** for specific error messages
3. ✅ **Consult troubleshooting** section above
4. ✅ **Open issue** with test output and environment details

---

## 🎯 Test Coverage Goals

- **Unit Tests**: 70%+ code coverage
- **Basic Tests**: 100% pass rate
- **Integration Tests**: 100% pass rate
- **Robustness Tests**: 80%+ overall robustness score
- **E2E Tests**: Complete workflow execution (connection optional)

---

<div align="center">

**Happy Testing! 🧪**

Made with ❤️ for robust middleware

</div>
