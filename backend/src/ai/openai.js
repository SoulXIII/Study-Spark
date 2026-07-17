// ── OpenAI AI Provider ────────────────────────────────────────────────────────

import { buildGenerateSchema, SOLVE_PROMPT, buildSummarizePrompt } from './schemas.js';

/**
 * OpenAI API Configuration
 */
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const MODEL = 'gpt-4-turbo'; // Using GPT-4 Turbo for best results

/**
 * Make an OpenAI API call
 */
const callOpenAI = async (messages, isJsonMode = false) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const body = {
    model: MODEL,
    messages,
    temperature: isJsonMode ? 0 : 0.7,
    max_tokens: isJsonMode ? 2000 : 4096,
  };

  // Enable JSON mode for structured output
  if (isJsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error (HTTP ${response.status}): ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from OpenAI');
  }

  return data.choices[0].message.content.trim();
};

/**
 * Handle generate type: create flashcards and quiz from content.
 */
export const generateOpenAI = async (options) => {
  const { textContent = null, imageBase64 = null, imageMimeType = null } = options;

  if (imageBase64) {
    throw new Error('OpenAI image support requires gpt-4-vision-preview model. Please use text-based input.');
  }

  const contentLength = textContent ? textContent.length : 0;
  const schema = buildGenerateSchema(contentLength);
  const prompt = `${textContent}\n\n${schema}`;

  console.log('[ai/openai] Calling OpenAI for generate... contentLength:', contentLength);
  const raw = await callOpenAI([{ role: 'user', content: prompt }], true);
  console.log('[ai/openai] Response length:', raw.length);

  if (!raw.trim()) throw new Error('OpenAI returned an empty response');

  try {
    return JSON.parse(raw);
  } catch (parseErr) {
    throw new Error(`Failed to parse OpenAI JSON response: ${parseErr.message}`);
  }
};

/**
 * Handle solve type: solve a problem and detect subject.
 */
export const solveOpenAI = async (options) => {
  const { text, fileData } = options;

  if (fileData) {
    throw new Error('OpenAI image support requires gpt-4-vision-preview model. Please provide text instead.');
  }

  if (!text) {
    throw new Error('Text input required for OpenAI');
  }

  const prompt = `${SOLVE_PROMPT}\n\nProblem: ${text.trim()}`;

  console.log('[ai/openai] Calling OpenAI for solve...');
  const raw = await callOpenAI([{ role: 'user', content: prompt }]);

  if (!raw.trim()) throw new Error('No response from OpenAI');

  return raw;
};

/**
 * Handle summarize type: generate a summary of flashcards.
 */
export const summarizeOpenAI = async (options) => {
  const { title, subject, content } = options;

  const prompt = buildSummarizePrompt(title, subject, content);

  console.log('[ai/openai] Calling OpenAI for summarize...');
  const summary = await callOpenAI([{ role: 'user', content: prompt }]);

  if (!summary.trim()) throw new Error('OpenAI returned an empty summary');

  return summary;
};
