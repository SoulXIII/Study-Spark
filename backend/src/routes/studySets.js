import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { callAI } from '../ai/index.js';

const router = express.Router();

// Get all study sets for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, subject, created_at, updated_at FROM study_sets WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get study sets error:', err);
    res.status(500).json({ error: 'Failed to get study sets' });
  }
});

// Get single study set
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, subject, created_at, updated_at FROM study_sets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study set not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get study set error:', err);
    res.status(500).json({ error: 'Failed to get study set' });
  }
});

// Get flashcards for a study set — due cards first (SM-2 ordering)
router.get('/:id/flashcards', authenticateToken, async (req, res) => {
  try {
    const setCheck = await pool.query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (setCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Study set not found' });
    }
    const result = await pool.query(
      `SELECT id, question, answer, difficulty,
              easiness_factor, repetitions, interval_days, next_review_date
       FROM flashcards WHERE study_set_id = $1
       ORDER BY next_review_date ASC, created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get flashcards error:', err);
    res.status(500).json({ error: 'Failed to get flashcards' });
  }
});

// SM-2 review — POST /study-sets/:id/flashcards/:cardId/review
// Body: { quality: 0-5 }  (0-2 = fail, 3-5 = pass)
router.post('/:id/flashcards/:cardId/review', authenticateToken, async (req, res) => {
  try {
    const { quality } = req.body;
    if (quality === undefined || quality < 0 || quality > 5) {
      return res.status(400).json({ error: 'quality must be an integer 0–5' });
    }

    // Verify ownership via study set
    const setCheck = await pool.query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (setCheck.rows.length === 0) return res.status(404).json({ error: 'Study set not found' });

    const cardRes = await pool.query(
      'SELECT easiness_factor, repetitions, interval_days FROM flashcards WHERE id = $1 AND study_set_id = $2',
      [req.params.cardId, req.params.id]
    );
    if (cardRes.rows.length === 0) return res.status(404).json({ error: 'Flashcard not found' });

    const { easiness_factor, repetitions, interval_days } = cardRes.rows[0];
    const { ef, n, interval, nextReview } = applySM2(easiness_factor, repetitions, interval_days, quality);

    await pool.query(
      `UPDATE flashcards
       SET easiness_factor = $1,
           repetitions = $2,
           interval_days = $3,
           next_review_date = $4,
           times_attempted = times_attempted + 1,
           times_correct = times_correct + $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [ef, n, interval, nextReview, quality >= 3 ? 1 : 0, req.params.cardId]
    );

    res.json({ easiness_factor: ef, repetitions: n, interval_days: interval, next_review_date: nextReview });
  } catch (err) {
    console.error('SM-2 review error:', err);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

function applySM2(ef, n, interval, quality) {
  let newEf = ef;
  let newN = n;
  let newInterval = interval;

  if (quality >= 3) {
    if (newN === 0) newInterval = 1;
    else if (newN === 1) newInterval = 6;
    else newInterval = Math.round(newInterval * newEf);
    newN += 1;
    newEf = newEf + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEf < 1.3) newEf = 1.3;
  } else {
    newN = 0;
    newInterval = 1;
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return { ef: newEf, n: newN, interval: newInterval, nextReview };
}

// Get quiz questions for a study set
router.get('/:id/quiz', authenticateToken, async (req, res) => {
  try {
    const setCheck = await pool.query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (setCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Study set not found' });
    }
    const result = await pool.query(
      'SELECT id, question, options, correct_option_index, explanation FROM quiz_questions WHERE study_set_id = $1 ORDER BY created_at',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get quiz questions error:', err);
    res.status(500).json({ error: 'Failed to get quiz questions' });
  }
});

// Create study set
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO study_sets (id, user_id, title, description, subject)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, description, subject, created_at, updated_at`,
      [id, req.user.id, title, description || null, subject || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create study set error:', err);
    res.status(500).json({ error: 'Failed to create study set' });
  }
});

// Update study set
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject } = req.body;
    const result = await pool.query(
      `UPDATE study_sets SET title = COALESCE($2, title),
       description = COALESCE($3, description),
       subject = COALESCE($4, subject),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $5
       RETURNING id, title, description, subject, created_at, updated_at`,
      [req.params.id, title, description, subject, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study set not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update study set error:', err);
    res.status(500).json({ error: 'Failed to update study set' });
  }
});

// Delete study set
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM study_sets WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study set not found' });
    }
    res.json({ message: 'Study set deleted successfully' });
  } catch (err) {
    console.error('Delete study set error:', err);
    res.status(500).json({ error: 'Failed to delete study set' });
  }
});

// POST /:id/summarize — AI summary of the study set's flashcards
router.post('/:id/summarize', authenticateToken, async (req, res) => {
  try {
    const setRes = await pool.query(
      'SELECT id, title, subject FROM study_sets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (setRes.rows.length === 0) return res.status(404).json({ error: 'Study set not found' });

    const fcRes = await pool.query(
      'SELECT question, answer FROM flashcards WHERE study_set_id = $1 ORDER BY created_at',
      [req.params.id]
    );
    if (fcRes.rows.length === 0) return res.status(400).json({ error: 'No flashcards to summarize' });

    const { title, subject } = setRes.rows[0];
    const content = fcRes.rows.map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${f.answer}`).join('\n');

    const summary = await callAI('summarize', { title, subject, content });
    res.json({ summary });
  } catch (err) {
    console.error('Summarize error:', err);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

export default router;
