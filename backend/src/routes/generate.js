import express from 'express';
import { awardXp } from '../utils/xp.js';
import fs from 'fs';
import { load as cheerioLoad } from 'cheerio';
import { PDFParse } from 'pdf-parse';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { callAI } from '../ai/index.js';
const router = express.Router();

// ── Wikipedia extractor (uses REST API — clean plaintext, no HTML parsing) ───

const isWikipediaUrl = (url) =>
  /wikipedia\.org\/wiki\/.+/i.test(url);

const getWikipediaText = async (url) => {
  // Extract article title from URL path
  const match = url.match(/wikipedia\.org\/wiki\/([^#?]+)/i);
  if (!match) throw new Error('Could not parse Wikipedia article title from URL');
  const title = decodeURIComponent(match[1]);
  console.log('[generate] Wikipedia article:', title);

  // Wikipedia Action API returns clean plaintext — no HTML parsing needed
  const apiUrl = `https://en.wikipedia.org/w/api.php?` +
    `action=query&prop=extracts&titles=${encodeURIComponent(title)}` +
    `&format=json&explaintext=true&exsectionformat=plain&origin=*`;

  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'StudySpark/1.0 (educational app)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Wikipedia API error (HTTP ${res.status})`);

  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) throw new Error('No data from Wikipedia API');

  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) throw new Error('Wikipedia article not found');

  const text = (page.extract || '').trim();
  if (text.length < 200) throw new Error('Wikipedia article content too short');

  console.log('[generate] Wikipedia text length:', text.length);
  // Skip the very first line (usually just the title) and return up to 20000 chars
  return text.split('\n').filter(l => l.trim()).slice(1).join(' ').slice(0, 20000);
};

// ── General article extractor (improved cheerio) ─────────────────────────────

// Tags that are never content — safe to remove globally
const ALWAYS_JUNK_TAGS = [
  'script', 'style', 'noscript', 'iframe', 'object', 'embed',
  'svg', 'canvas', 'video', 'audio', 'picture', 'map', 'form',
];

// Structural noise — remove ONLY outside the found content container
const STRUCTURAL_JUNK_TAGS = ['header', 'nav', 'footer', 'aside'];

// Class/id substrings that mark non-content elements WITHIN content
const INNER_JUNK_PATTERNS = [
  'sidebar', 'side-bar', 'nav', 'menu', 'logo', 'banner',
  'advertisement', 'advert', 'ads-', '-ad-', 'cookie', 'popup',
  'modal', 'overlay', 'social', 'share', 'tweet', 'related',
  'recommended', 'trending', 'newsletter', 'subscribe', 'breadcrumb',
  'pagination', 'toc', 'table-of-contents', 'edit-section',
  'mw-editsection', 'reflist', 'references', 'external-links',
  'printfooter', 'catlinks', 'mw-hidden',
];

// Candidate selectors for main content — tried in priority order
const CONTENT_SELECTORS = [
  'article[role="main"]', 'main[role="main"]',
  'article', 'main',
  '[role="main"]',
  '.mw-parser-output',           // Wikipedia
  '#mw-content-text',            // Wikipedia fallback
  '.article-body', '.article-content', '.article__body',
  '.post-content', '.post-body', '.entry-content',
  '.content-body', '.story-body', '.story-content',
  '.news-body', '.news-content',
  '#content-body', '#article-body', '#story-body',
  '#main-content', '#page-content', '#primary-content',
];

// Navigation phrases to strip at the line level
const NAV_LINE = [
  /^(home|back|next|previous|skip to|jump to|read more|see also|external links|references|notes|further reading|bibliography|categories|navigation menu|personal tools|contents|retrieved from|edit source|edit this page)/i,
  /\[\s*edit\s*\]/i,
  /^\s*\[\d+\]\s*$/,
];

const getArticleContent = async (url) => {
  // Wikipedia gets its own clean API path
  if (isWikipediaUrl(url)) return getWikipediaText(url);

  console.log('[generate] Fetching article:', url);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Could not fetch article (HTTP ${res.status})`);
  const html = await res.text();

  const $ = cheerioLoad(html);

  // Step 1 — remove tags that are never content (global, safe)
  ALWAYS_JUNK_TAGS.forEach(tag => $(tag).remove());

  // Step 2 — find the best content container BEFORE removing structural elements
  //          (avoids accidentally removing a wrapper that contains the content)
  let contentEl = null;
  for (const sel of CONTENT_SELECTORS) {
    const found = $(sel).first();
    if (found.length && found.text().trim().length > 300) {
      contentEl = found;
      break;
    }
  }

  // Fallback: largest <div> or <section> on the page
  if (!contentEl) {
    let bestLen = 0;
    $('div, section').each((_, el) => {
      const t = $(el).text().trim().length;
      if (t > bestLen) { bestLen = t; contentEl = $(el); }
    });
  }

  if (!contentEl || contentEl.text().trim().length < 200) {
    throw new Error('Could not locate article content. Try pasting the text directly using the "Text" tab.');
  }

  // Step 3 — remove structural noise WITHIN the found container
  STRUCTURAL_JUNK_TAGS.forEach(tag => contentEl.find(tag).remove());

  // Step 4 — remove non-content elements by class/id WITHIN the container
  contentEl.find('*').each((_, el) => {
    const cls = ($(el).attr('class') || '').toLowerCase();
    const id  = ($(el).attr('id')    || '').toLowerCase();
    if (INNER_JUNK_PATTERNS.some(p => cls.includes(p) || id.includes(p))) {
      $(el).remove();
    }
  });

  // Step 5 — extract, deduplicate, and filter lines
  const rawText = contentEl.text();
  const seen = new Set();
  const lines = rawText
    .split(/[\n\r]+/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => {
      if (l.length < 40) return false;
      if (l.split(' ').length < 6) return false;
      if (seen.has(l)) return false;
      if (NAV_LINE.some(p => p.test(l))) return false;
      if (/^[\W\d\s]+$/.test(l)) return false;
      seen.add(l);
      return true;
    });

  const text = lines.join(' ').slice(0, 20000);
  if (text.length < 200) throw new Error('Article content too short or could not be extracted. Try pasting the text directly.');
  console.log('[generate] Article text length:', text.length, 'lines:', lines.length);
  return text;
};

// ── PDF helpers ───────────────────────────────────────────────────────────────

/**
 * Pick a representative set of page numbers from a PDF.
 * Always includes the first few pages (intro/abstract/ToC) and last few
 * (conclusion/references), plus evenly-sampled pages from the middle.
 */
const selectPages = (total, firstN, lastN, middleN) => {
  const pages = new Set();
  for (let i = 1; i <= Math.min(firstN, total); i++) pages.add(i);
  for (let i = Math.max(1, total - lastN + 1); i <= total; i++) pages.add(i);
  const midStart = firstN + 1;
  const midEnd   = total - lastN;
  if (midEnd >= midStart && middleN > 0) {
    const step = Math.max(1, Math.floor((midEnd - midStart) / (middleN + 1)));
    for (let i = midStart; i <= midEnd; i += step) {
      pages.add(i);
      if ([...pages].filter(p => p >= midStart && p <= midEnd).length >= middleN) break;
    }
  }
  return [...pages].sort((a, b) => a - b);
};

/**
 * Clean up extracted PDF text — strip front matter, junk lines, ToC entries,
 * deduplicate headers/footers, and trim to a character budget.
 */
const MAX_CHARS = 20000;

// Lines that are almost certainly front-matter / non-content
const FRONT_MATTER_RE = [
  /^(table of contents|contents|list of (figures|tables|abbreviations)|index)$/i,
  /^(abstract|acknowledgements?|preface|foreword|dedication|copyright|isbn|doi|publisher|edition|printed in)$/i,
  /^\s*(author|authors|editor|editors|affiliation|department|university|institute|email|correspondence)\b/i,
  /^https?:\/\//i,                                      // bare URLs
  /\.{4,}\s*\d+\s*$/,                                   // ToC entries: "Chapter 1 ........ 5"
  /^\s*\d+\s*$/,                                        // lone page numbers
  /^(\d+\.){1,4}\s*$/,                                  // bare section numbers "1.2.3."
  /^(figure|fig\.|table|appendix|bibliography|references)\s*\d*/i,  // figure/table captions w/o content
];

const isFrontMatterLine = (line) => FRONT_MATTER_RE.some(r => r.test(line));

const cleanPdfText = (raw) => {
  const seen = new Set();
  const lines = raw
    .split(/\n/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => {
      if (l.length < 25) return false;              // too short (page numbers, headers, etc.)
      if (seen.has(l)) return false;                // duplicate (running headers/footers)
      if (isFrontMatterLine(l)) return false;       // ToC, author info, index entries
      seen.add(l);
      return true;
    });
  return lines.join('\n').slice(0, MAX_CHARS);
};

const getPdfText = async (filePath) => {
  console.log('[generate] Parsing PDF:', filePath);
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer, verbosity: 0 });

  // Step 1: load structure only (fast — just reads PDF xref/metadata)
  const doc = await parser.load();
  const totalPages = doc.numPages;
  console.log(`[generate] PDF: ${totalPages} pages`);

  // Step 2: decide which pages to read
  let parseParams;
  if (totalPages <= 25) {
    // Small PDF — read everything
    parseParams = { pageJoiner: '' };
    console.log('[generate] PDF strategy: full read');
  } else if (totalPages <= 80) {
    // Medium — first 6 + 10 sampled middle + last 4
    const pages = selectPages(totalPages, 6, 4, 10);
    parseParams = { partial: pages, pageJoiner: '' };
    console.log(`[generate] PDF strategy: ${pages.length} sampled pages of ${totalPages}`);
  } else {
    // Large — first 5 + 10 sampled middle + last 3
    const pages = selectPages(totalPages, 5, 3, 10);
    parseParams = { partial: pages, pageJoiner: '' };
    console.log(`[generate] PDF strategy: ${pages.length} sampled pages of ${totalPages}`);
  }

  // Step 3: extract text only from selected pages
  const result = await parser.getText(parseParams);
  const text = cleanPdfText(result.text || '');

  if (!text.trim()) throw new Error('Could not extract text from PDF — it may be scanned or image-only');
  console.log('[generate] PDF final text length:', text.length);
  return text;
};

// ── POST /api/generate ────────────────────────────────────────────────────────

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { type, content, uploadId } = req.body;
    console.log('[generate] Request:', { type, hasContent: !!content, uploadId });

    if (!type) return res.status(400).json({ error: 'type is required' });

    let generated;

    if (type === 'image' || type === 'scan') {
      if (!uploadId) return res.status(400).json({ error: 'uploadId required for image/scan' });
      const row = await pool.query(
        'SELECT path, mimetype FROM uploads WHERE id = $1 AND user_id = $2',
        [uploadId, req.user.id]
      );
      if (!row.rows.length) return res.status(404).json({ error: 'Upload not found' });
      const { path: filePath, mimetype } = row.rows[0];
      const base64 = fs.readFileSync(filePath).toString('base64');
      generated = await callAI('generate', { imageBase64: base64, imageMimeType: mimetype });

    } else if (type === 'pdf') {
      if (!uploadId) return res.status(400).json({ error: 'uploadId required for PDF' });
      const row = await pool.query(
        'SELECT path FROM uploads WHERE id = $1 AND user_id = $2',
        [uploadId, req.user.id]
      );
      if (!row.rows.length) return res.status(404).json({ error: 'Upload not found' });
      const pdfText = await getPdfText(row.rows[0].path);
      generated = await callAI('generate', {
        textContent: `PDF content (ignore any front matter such as title pages, author info, table of contents, index, references list, or acknowledgements — focus only on the actual subject matter and explanatory content):\n${pdfText}`
      });

    } else if (type === 'article') {
      if (!content) return res.status(400).json({ error: 'Article URL required' });
      const articleText = await getArticleContent(content);
      generated = await callAI('generate', { textContent: `Article content:\n${articleText}` });

    } else if (type === 'topic') {
      if (!content) return res.status(400).json({ error: 'Topic required' });
      generated = await callAI('generate', {
        textContent: `Study topic: "${content}"\n\nCreate comprehensive study materials for a student learning this topic from scratch.`
      });

    } else if (type === 'text') {
      if (!content) return res.status(400).json({ error: 'Text content required' });
      generated = await callAI('generate', { textContent: `Study material:\n${content}` });

    } else {
      return res.status(400).json({ error: `Unknown type: ${type}` });
    }

    const { title, subject, flashcards, quiz } = generated;
    console.log('[generate] Generated:', { title, subject, cards: flashcards?.length, quiz: quiz?.length });

    if (!title || !subject || !Array.isArray(flashcards) || !Array.isArray(quiz)) {
      throw new Error('AI returned incomplete data — please try again');
    }

    // ── Each topic gets its own study set ────────────────────────────────────
    const studySetId = uuidv4();
    await pool.query(
      `INSERT INTO study_sets (id, user_id, title, description, subject)
       VALUES ($1, $2, $3, $4, $5)`,
      [studySetId, req.user.id, title, null, subject]
    );

    for (const card of flashcards) {
      if (!card.question || !card.answer) continue;
      await pool.query(
        'INSERT INTO flashcards (id, study_set_id, question, answer) VALUES ($1, $2, $3, $4)',
        [uuidv4(), studySetId, card.question, card.answer]
      );
    }

    for (const q of quiz) {
      if (!q.question || !Array.isArray(q.options) || q.correct_option_index == null) continue;
      await pool.query(
        `INSERT INTO quiz_questions
           (id, study_set_id, question, options, correct_option_index, explanation)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), studySetId, q.question, q.options, q.correct_option_index, q.explanation || '']
      );
    }

    // ── Auto-create or find a subject folder, then add the study set to it ───
    let folder = await pool.query(
      `SELECT id FROM folders WHERE user_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [req.user.id, subject]
    );

    let folderId;
    if (folder.rows.length > 0) {
      folderId = folder.rows[0].id;
    } else {
      folderId = uuidv4();
      await pool.query(
        `INSERT INTO folders (id, user_id, name) VALUES ($1, $2, $3)`,
        [folderId, req.user.id, subject]
      );
    }

    await pool.query(
      `INSERT INTO folder_study_sets (folder_id, study_set_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [folderId, studySetId]
    );

    await awardXp(req.user.id, 40, 'create_study_set');
    console.log('[generate] Done. studySetId:', studySetId, 'folderId:', folderId);
    res.json({ studySetId, studySetTitle: title, topic: title, subject, folderId, flashcardCount: flashcards.length, quizCount: quiz.length, isExisting: false });

  } catch (err) {
    console.error('[generate] ERROR:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

export default router;
