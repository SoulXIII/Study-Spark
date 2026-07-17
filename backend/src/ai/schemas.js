// ── Shared schemas, prompts, and utilities for AI providers ──────────────────

/**
 * Generate output rules based on content length for flashcard/quiz generation.
 * Ensures adequate coverage for documents of varying sizes.
 */
export const getCountRules = (contentLength) => {
  if (contentLength < 1500) {
    return '- 8–12 flashcards\n- 5–8 quiz questions';
  } else if (contentLength < 5000) {
    return '- 15–20 flashcards\n- 10–14 quiz questions';
  } else if (contentLength < 12000) {
    return '- 20–28 flashcards\n- 15–20 quiz questions';
  } else {
    return '- 28–35 flashcards\n- 20–25 quiz questions';
  }
};

/**
 * Shared JSON schema for flashcard/quiz generation.
 * Used across all providers to ensure consistent output format.
 */
export const buildGenerateSchema = (contentLength = 0) => `Return ONLY a valid JSON object — no markdown, no extra text — with this exact structure:
{
  "title": "Specific topic title (max 60 chars)",
  "subject": "Pick ONE: Mathematics, Biology, Chemistry, Physics, History, Geography, Computer Science, Literature, Economics, Psychology, Philosophy, Sociology, Law, Medicine, Political Science, Music, Art, Languages, Engineering, Business, Nutrition, Astronomy, Environmental Science, Other",
  "flashcards": [
    { "question": "...", "answer": "..." }
  ],
  "quiz": [
    {
      "question": "...",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_option_index": 0,
      "explanation": "..."
    }
  ]
}
Rules:
${getCountRules(contentLength)}
- All questions SPECIFIC to the provided material — not generic
- Cover a wide range of topics from across the material, not just the beginning
- correct_option_index must be 0, 1, 2, or 3`;

/**
 * Prompt for solving problems. Used by solve endpoint.
 * Expects AI to output subject on first line, then full solution.
 */
export const SOLVE_PROMPT = `You are a knowledgeable tutor.

First line of your response MUST be in this exact format (one line only):
Subject: [subject area, e.g. Mathematics, Physics, Chemistry, Biology, Computer Science, History, Economics, Statistics, Engineering]

Then provide a complete solution:
- Use proper markdown formatting (headers, bold, bullet points, numbered lists)
- Use LaTeX math notation wrapped in $ for inline math and $$ for display math (e.g. $x^2$, $$\\int_0^x f(t)dt$$)
- Show all working steps clearly
- Explain each step briefly so the student understands
- End with a clear final answer
- Do not truncate or abbreviate — give the full solution`;

/**
 * Parse the subject and solution from AI response.
 * Subject must be on the first line in format: "Subject: [name]"
 */
export function parseSubjectAndSolution(raw) {
  const firstNewline = raw.indexOf('\n');
  const firstLine = firstNewline === -1 ? raw : raw.slice(0, firstNewline);
  if (firstLine.toLowerCase().startsWith('subject:')) {
    const subject = firstLine.slice('subject:'.length).trim();
    const solution = raw.slice(firstNewline + 1).replace(/^\n+/, '');
    return { subject, solution };
  }
  return { subject: null, solution: raw };
}

/**
 * Build a summarization prompt for flashcard summaries.
 */
export const buildSummarizePrompt = (title, subject, content) => `You are a study assistant. Below are flashcards from a study set titled "${title}" (subject: ${subject || 'General'}).

${content}

Write a clear, concise summary (200–300 words) of the key concepts covered. Use plain paragraphs — no bullet points or headers. Focus on the most important ideas and how they connect.`;
