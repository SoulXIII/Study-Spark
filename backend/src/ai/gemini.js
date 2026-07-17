// ── Google Gemini AI Provider ─────────────────────────────────────────────────

import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildGenerateSchema, SOLVE_PROMPT, buildSummarizePrompt } from './schemas.js';

/**
 * Get Gemini client instance
 */
const getGemini = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenerativeAI(key);
};

/**
 * Handle generate type: create flashcards and quiz from content.
 * Supports text, image (with base64), and mixed content.
 */
export const generateGemini = async (options) => {
  const { textContent = null, imageBase64 = null, imageMimeType = null } = options;

  const genAI = getGemini();
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const contentLength = textContent ? textContent.length : 0;
  const schema = buildGenerateSchema(contentLength);

  let parts;
  if (imageBase64) {
    parts = [
      { inlineData: { data: imageBase64, mimeType: imageMimeType } },
      { text: `Read ALL visible text in this image carefully, then:\n${buildGenerateSchema(500)}` },
    ];
  } else {
    parts = [{ text: `${textContent}\n\n${schema}` }];
  }

  console.log('[ai/gemini] Calling Gemini for generate... contentLength:', contentLength);
  const result = await model.generateContent(parts);
  const raw = result.response.text();
  console.log('[ai/gemini] Gemini response length:', raw.length);

  if (!raw.trim()) throw new Error('Gemini returned an empty response');

  try {
    return JSON.parse(raw);
  } catch (parseErr) {
    throw new Error(`Failed to parse Gemini JSON response: ${parseErr.message}`);
  }
};

/**
 * Handle solve type: solve a problem and detect subject.
 * Supports text or image input.
 */
export const solveGemini = async (options) => {
  const { uploadId, text, fileData } = options;

  const genAI = getGemini();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { maxOutputTokens: 8192, temperature: 0.2 },
  });

  let parts;

  if (fileData) {
    // fileData = { base64, mimeType }
    parts = [
      { inlineData: { data: fileData.base64, mimeType: fileData.mimeType } },
      { text: SOLVE_PROMPT },
    ];
  } else if (text) {
    parts = [{ text: `${SOLVE_PROMPT}\n\nProblem: ${text.trim()}` }];
  } else {
    throw new Error('Either uploadId/fileData or text must be provided');
  }

  console.log('[ai/gemini] Calling Gemini for solve...');
  let result;
  try {
    result = await model.generateContent(parts);
  } catch (modelErr) {
    console.warn('[ai/gemini] gemini-3.5-flash failed, falling back:', modelErr.message);
    const fallback = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: { maxOutputTokens: 8192, temperature: 0.2 },
    });
    result = await fallback.generateContent(parts);
  }

  const raw = result.response.text().trim();
  if (!raw) throw new Error('No response from Gemini');

  return raw;
};

/**
 * Handle summarize type: generate a summary of flashcards.
 */
export const summarizeGemini = async (options) => {
  const { title, subject, content } = options;

  const genAI = getGemini();
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

  const prompt = buildSummarizePrompt(title, subject, content);

  console.log('[ai/gemini] Calling Gemini for summarize...');
  const result = await model.generateContent(prompt);
  const summary = result.response.text().trim();

  if (!summary) throw new Error('Gemini returned an empty summary');
  return summary;
};
