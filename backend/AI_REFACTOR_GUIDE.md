# AI Layer Refactoring - Architecture & Implementation Guide

## Overview

StudySpark's AI layer has been refactored to support multiple AI providers (Gemini, OpenRouter, Groq, etc.) with a clean, modular architecture. The refactoring maintains 100% backward compatibility—all endpoints, request/response formats, and functionality remain unchanged.

---

## Files Changed & Why

### New Files Created

#### 1. `backend/src/ai/index.js`
**Purpose**: Main entry point for all AI operations. Implements the pluggable provider system.

**Key Features**:
- Single public function: `callAI(type, options)`
- Provider routing based on `process.env.AI_PROVIDER`
- Provider map that allows easy registration of new providers
- Abstracts provider implementation details from route handlers

**Usage**:
```javascript
// Generate flashcards from text
await callAI('generate', { textContent: '...' })

// Generate from image
await callAI('generate', { imageBase64: '...', imageMimeType: 'image/jpeg' })

// Solve a problem
await callAI('solve', { text: '...' })
await callAI('solve', { fileData: { base64: '...', mimeType: 'image/jpeg' } })

// Summarize flashcards
await callAI('summarize', { title: '...', subject: '...', content: '...' })
```

#### 2. `backend/src/ai/schemas.js`
**Purpose**: Shared schemas, prompts, and utility functions used across all providers.

**Exports**:
- `buildGenerateSchema(contentLength)` - JSON schema for flashcard/quiz generation
- `getCountRules(contentLength)` - Rules that scale output based on content length
- `SOLVE_PROMPT` - System prompt for problem solving
- `parseSubjectAndSolution(raw)` - Parse AI response to extract subject and solution
- `buildSummarizePrompt(title, subject, content)` - Build prompt for summarization

**Benefits**:
- Single source of truth for all prompts
- Ensures consistency across providers
- No duplication of business logic

#### 3. `backend/src/ai/gemini.js`
**Purpose**: Google Gemini provider implementation. Contains all Gemini-specific API calls.

**Exports** (three main functions):
- `generateGemini(options)` - Generate flashcards/quiz from content or image
- `solveGemini(options)` - Solve problems with optional image input
- `summarizeGemini(options)` - Generate study set summaries

**Details**:
- Uses `gemini-flash-latest` for generation (structured JSON output)
- Uses `gemini-2.0-flash` for problem solving (detailed explanations)
- Handles image-to-text extraction for scans
- Includes fallback logic for API errors
- Only this file knows about GoogleGenerativeAI SDK

---

### Modified Files

#### 1. `backend/src/routes/generate.js`

**Changes Made**:
```
- Removed: GoogleGenerativeAI import
- Removed: getGemini() function
- Removed: buildSchema() function
- Removed: getCountRules() function
- Removed: callGemini() function (entire 50-line function)
- Added: import { callAI } from '../ai/index.js'
- Updated: 6 callGemini(...) calls → callAI('generate', {...})
```

**Call Pattern**:
```javascript
// BEFORE:
generated = await callGemini(textContent, imageBase64, imageMimeType);

// AFTER:
generated = await callAI('generate', { textContent, imageBase64, imageMimeType });
```

**Preserved**:
- All content extraction logic (Wikipedia, articles, PDFs)
- All database operations
- All response formatting
- Error handling behavior

#### 2. `backend/src/routes/solve.js`

**Changes Made**:
```
- Removed: GoogleGenerativeAI import
- Removed: getGemini() function
- Removed: SOLVE_PROMPT constant (moved to schemas.js)
- Removed: parseSubjectAndSolution() function (moved to schemas.js)
- Removed: Direct model.generateContent() calls
- Added: import { callAI } from '../ai/index.js'
- Added: import { parseSubjectAndSolution } from '../ai/schemas.js'
- Updated: Endpoint now uses callAI('solve', {...})
```

**Simplified Logic**:
```javascript
// BEFORE: 40 lines of GoogleGenerativeAI client setup and error handling
// AFTER: 2 lines total for the AI call

result = await callAI('solve', { fileData: { base64, mimeType } });
```

**Preserved**:
- Image upload handling
- Response format (solution + subject)
- Error handling and logging

#### 3. `backend/src/routes/studySets.js`

**Changes Made**:
```
- Removed: GoogleGenerativeAI import
- Removed: Direct GoogleGenerativeAI instantiation
- Removed: model.generateContent() call
- Added: import { callAI } from '../ai/index.js'
- Updated: Summarize endpoint now uses callAI('summarize', {...})
```

**Simplified Logic**:
```javascript
// BEFORE: Direct model setup + prompt construction + API call
// AFTER: Single clean function call
const summary = await callAI('summarize', { title, subject, content });
```

**Preserved**:
- Flashcard retrieval logic
- Response formatting
- Error handling

---

## Architecture & Design Decisions

### Provider Registration Pattern

```javascript
// backend/src/ai/index.js
const providerMap = {
  gemini: {
    generate: generateGemini,
    solve: solveGemini,
    summarize: summarizeGemini,
  },
  // Add new providers here
};
```

**Why This Design**:
1. **Minimal coupling** - Route files don't import specific providers
2. **Easy registration** - Add one provider object to the map
3. **Type safety** - Each provider implements the same interface
4. **Testability** - Easy to mock or replace providers

### Operation Types

All AI operations are categorized into three types:

| Type | Purpose | Input | Output |
|------|---------|-------|--------|
| `generate` | Create flashcards & quiz | Text or image | `{ title, subject, flashcards[], quiz[] }` |
| `solve` | Solve a problem | Text or image | Plain text with "Subject: X" on first line |
| `summarize` | Summarize flashcards | Title + subject + content | Plain text summary |

**Benefits**:
- Clear separation of concerns
- Easy to understand what each operation does
- Consistent error handling across types

### Error Handling Strategy

Each provider's functions throw descriptive errors:

```javascript
// User-friendly error messages
throw new Error('GEMINI_API_KEY is not set');
throw new Error('Failed to parse Gemini JSON response: ...');

// Route handlers catch and return 500 with error message
catch (err) {
  res.status(500).json({ error: err.message });
}
```

**Benefits**:
- Errors bubble up with context
- Frontend gets meaningful error messages
- Logs include provider-specific details

---

## How to Add a New AI Provider

### Step 1: Create Provider File

Create `backend/src/ai/myprovider.js`:

```javascript
// ── MyProvider AI Provider ────────────────────────────────────────────

import { buildGenerateSchema, SOLVE_PROMPT, buildSummarizePrompt } from './schemas.js';

export const generateMyProvider = async (options) => {
  const { textContent = null, imageBase64 = null, imageMimeType = null } = options;
  
  // Use API key from environment
  const apiKey = process.env.MYPROVIDER_API_KEY;
  if (!apiKey) throw new Error('MYPROVIDER_API_KEY is not set');
  
  // Your provider-specific implementation here
  const schema = buildGenerateSchema(textContent?.length || 0);
  
  // Make API calls using your provider's SDK/API
  // Return: { title, subject, flashcards, quiz }
};

export const solveMyProvider = async (options) => {
  const { fileData, text } = options;
  
  // Your provider-specific implementation
  // Return: Plain text with "Subject: X" on first line
};

export const summarizeMyProvider = async (options) => {
  const { title, subject, content } = options;
  
  const prompt = buildSummarizePrompt(title, subject, content);
  
  // Your provider-specific implementation
  // Return: String summary
};
```

### Step 2: Register Provider in Index

Edit `backend/src/ai/index.js`:

```javascript
import { generateMyProvider, solveMyProvider, summarizeMyProvider } from './myprovider.js';

const providerMap = {
  gemini: { /* ... */ },
  myprovider: {
    generate: generateMyProvider,
    solve: solveMyProvider,
    summarize: summarizeMyProvider,
  },
};
```

### Step 3: Update Environment Variables

Add to `backend/.env`:

```env
AI_PROVIDER=myprovider
MYPROVIDER_API_KEY=your_api_key_here
```

### Step 4: No Other Changes Needed!

✅ Routes work automatically  
✅ Database logic unchanged  
✅ Frontend receives same responses  
✅ All features work out of the box

---

## Feature Preservation

Every existing feature continues to work without modification:

| Feature | Provider | Status |
|---------|----------|--------|
| Flashcard generation | ✅ Gemini | Working |
| Quiz generation | ✅ Gemini | Working |
| Problem solving | ✅ Gemini | Working |
| Summarization | ✅ Gemini | Working |
| Image scanning | ✅ Gemini | Working |
| PDF processing | ✅ Gemini | Working |
| Article extraction | ✅ Gemini | Working |
| Wikipedia content | ✅ Gemini | Working |
| JSON structured output | ✅ Gemini | Working |
| Retry/fallback logic | ✅ Gemini | Working |

---

## Configuration & Deployment

### Environment Variables

```env
# Required
GEMINI_API_KEY=your_gemini_key_here

# Optional - defaults to 'gemini'
AI_PROVIDER=gemini
```

### Switching Providers

To use a different provider at runtime:

```bash
# Use Gemini (default)
export AI_PROVIDER=gemini

# Use OpenRouter (after implementation)
export AI_PROVIDER=openrouter
export OPENROUTER_API_KEY=your_key

# Use Groq (after implementation)
export AI_PROVIDER=groq
export GROQ_API_KEY=your_key
```

### No Frontend Changes Required

The frontend doesn't need any modifications:
- All API endpoints remain the same
- All request/response formats are identical
- All functionality is preserved

---

## Testing & Validation

All endpoints tested and working:

✅ `POST /api/generate` (image, pdf, article, topic, text)  
✅ `POST /api/solve` (text, image)  
✅ `POST /api/study-sets/:id/summarize`  

---

## Minimal Diff Summary

- **Lines Added**: ~150 (new files)
- **Lines Removed**: ~120 (old Gemini-specific code)
- **Net Change**: +30 lines (mostly comments/structure)
- **Files Changed**: 6 (3 new, 3 modified)
- **Routes/Endpoints Modified**: 0 (all backward compatible)
- **Frontend Changes Required**: 0

---

## API Contracts (Unchanged)

All API responses remain identical:

### POST /api/generate
```json
// Response (same as before)
{
  "studySetId": "...",
  "studySetTitle": "...",
  "subject": "...",
  "flashcardCount": 15,
  "quizCount": 10
}
```

### POST /api/solve
```json
// Response (same as before)
{
  "solution": "...",
  "subject": "Mathematics"
}
```

### POST /api/study-sets/:id/summarize
```json
// Response (same as before)
{
  "summary": "..."
}
```

---

## Future Enhancements

The architecture supports:
- ✅ Adding new providers (OpenRouter, Groq, Claude, etc.)
- ✅ Provider-specific feature flags
- ✅ Load balancing across providers
- ✅ Fallback chains (use Provider B if Provider A fails)
- ✅ Cost optimization (use cheaper provider for simpler tasks)
- ✅ A/B testing different providers

---

## Troubleshooting

### "AI_PROVIDER is not supported"
- Check `process.env.AI_PROVIDER` value
- Ensure provider is registered in `backend/src/ai/index.js`

### "API key is not set"
- Check environment variable name (case-sensitive)
- Verify `.env` file is loaded
- Example: `GEMINI_API_KEY` for Gemini

### Provider gives different output than Gemini
- Each provider may interpret prompts differently
- Adjust shared schemas in `backend/src/ai/schemas.js` if needed
- Add provider-specific schema overrides in provider file

---

## Contact & Support

Questions about the architecture? Check:
1. Inline comments in `backend/src/ai/*.js`
2. Inline comments in modified route files
3. This guide document
