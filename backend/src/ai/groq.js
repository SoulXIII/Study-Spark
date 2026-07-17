// ── Groq AI Provider ──────────────────────────────────────────────────────────

import { buildGenerateSchema, SOLVE_PROMPT, buildSummarizePrompt } from './schemas.js';

/**
 * Groq API Configuration
 */
const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

// Model to use (Groq has fast inference)
const MODEL = 'mixtral-8x7b-32768'; // Fast and capable

/**
 * Make a Groq API call
 */
const callGroq = async (messages, isJsonMode = false) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const body = {
    model: MODEL,
    messages,
    temperature: isJsonMode ? 0 : 0.7,
    max_tokens: isJsonMode ? 2000 : 4096,
  };

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Groq API error (HTTP ${response.status}): ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from Groq');
  }

  return data.choices[0].message.content.trim();
};

/**
 * Handle generate type: create flashcards and quiz from content.
 */
export const generateGroq = async (options) => {
  const { textContent = null, imageBase64 = null, imageMimeType = null } = options;

  if (imageBase64) {
    throw new Error('Groq does not support image inputs. Please use text-based input.');
  }

  const contentLength = textContent ? textContent.length : 0;
  const schema = buildGenerateSchema(contentLength);
  const prompt = `${textContent}\n\n${schema}`;

  console.log('[ai/groq] Calling Groq for generate... contentLength:', contentLength);
  const raw = await callGroq([{ role: 'user', content: prompt }], true);
  console.log('[ai/groq] Response length:', raw.length);

  if (!raw.trim()) throw new Error('Groq returned an empty response');

  try {
    return JSON.parse(raw);
  } catch (parseErr) {
    throw new Error(`Failed to parse Groq JSON response: ${parseErr.message}`);
  }
};

/**
 * Handle solve type: solve a problem and detect subject.
 */
export const solveGroq = async (options) => {
  const { text, fileData } = options;

  if (fileData) {
    throw new Error('Groq does not support image inputs. Please provide text instead.');
  }

  if (!text) {
    throw new Error('Text input required for Groq');
  }

  const prompt = `${SOLVE_PROMPT}\n\nProblem: ${text.trim()}`;

  console.log('[ai/groq] Calling Groq for solve...');
  const raw = await callGroq([{ role: 'user', content: prompt }]);

  if (!raw.trim()) throw new Error('No response from Groq');

  return raw;
};

/**
 * Handle summarize type: generate a summary of flashcards.
 */
export const summarizeGroq = async (options) => {
  const { title, subject, content } = options;

  const prompt = buildSummarizePrompt(title, subject, content);

  console.log('[ai/groq] Calling Groq for summarize...');
  const summary = await callGroq([{ role: 'user', content: prompt }]);

  if (!summary.trim()) throw new Error('Groq returned an empty summary');

  return summary;
};
