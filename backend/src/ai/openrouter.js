// ── OpenRouter AI Provider ────────────────────────────────────────────────────

import { buildGenerateSchema, SOLVE_PROMPT, buildSummarizePrompt } from './schemas.js';

/**
 * OpenRouter API Configuration
 */
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || 'openrouter/free';

const MODELS = {
  generate: DEFAULT_MODEL,
  solve: DEFAULT_MODEL,
  summarize: DEFAULT_MODEL,
};
/**
 * Make an OpenRouter API call
 */
const callOpenRouter = async (messages, isJsonMode = false) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  // Determine model based on current operation
  const model = MODELS.generate; // Default to generate model

  const body = {
    model,
    messages,
    temperature: isJsonMode ? 0 : 0.7,
    max_tokens: isJsonMode ? 800 : 1200,
  };

  // For JSON mode, add instructions to response format
  if (isJsonMode) {
    body.system = 'You must respond with ONLY valid JSON, no markdown, no extra text.';
  }

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://studyspark.edu', // Required by OpenRouter
      'X-Title': 'StudySpark',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter API error (HTTP ${response.status}): ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from OpenRouter');
  }

  return data.choices[0].message.content.trim();
};

/**
 * Handle generate type: create flashcards and quiz from content.
 */
export const generateOpenRouter = async (options) => {
  const { textContent = null, imageBase64 = null, imageMimeType = null } = options;

  if (imageBase64) {
    throw new Error('OpenRouter currently does not support image inputs in this implementation. Please use text-based input.');
  }

  const contentLength = textContent ? textContent.length : 0;
  const schema = buildGenerateSchema(contentLength);

  const prompt = `${textContent}\n\n${schema}`;

  console.log('[ai/openrouter] Calling OpenRouter for generate... contentLength:', contentLength);
  const raw = await callOpenRouter(
    [{ role: 'user', content: prompt }],
    true // JSON mode
  );
  console.log('[ai/openrouter] Response length:', raw.length);

  if (!raw.trim()) throw new Error('OpenRouter returned an empty response');

  try {
    return JSON.parse(raw);
  } catch (parseErr) {
    throw new Error(`Failed to parse OpenRouter JSON response: ${parseErr.message}`);
  }
};

/**
 * Handle solve type: solve a problem and detect subject.
 */
export const solveOpenRouter = async (options) => {
  const { text, fileData } = options;

  if (fileData) {
    throw new Error('OpenRouter currently does not support image inputs in this implementation. Please provide text instead.');
  }

  if (!text) {
    throw new Error('Text input required for OpenRouter');
  }

  const prompt = `${SOLVE_PROMPT}\n\nProblem: ${text.trim()}`;

  console.log('[ai/openrouter] Calling OpenRouter for solve...');
  const raw = await callOpenRouter([{ role: 'user', content: prompt }]);

  if (!raw.trim()) throw new Error('No response from OpenRouter');

  return raw;
};

/**
 * Handle summarize type: generate a summary of flashcards.
 */
export const summarizeOpenRouter = async (options) => {
  const { title, subject, content } = options;

  const prompt = buildSummarizePrompt(title, subject, content);

  console.log('[ai/openrouter] Calling OpenRouter for summarize...');
  const summary = await callOpenRouter([{ role: 'user', content: prompt }]);

  if (!summary.trim()) throw new Error('OpenRouter returned an empty summary');

  return summary;
};
