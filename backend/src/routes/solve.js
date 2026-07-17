import express from 'express';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import { callAI } from '../ai/index.js';
import { parseSubjectAndSolution } from '../ai/schemas.js';

const router = express.Router();

// POST /api/solve — solve a problem, return solution + detected subject
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { uploadId, text } = req.body;
    if (!uploadId && !text?.trim()) {
      return res.status(400).json({ error: 'Provide an image (uploadId) or text problem.' });
    }

    let result;

    if (uploadId) {
      const row = await pool.query(
        'SELECT path, mimetype FROM uploads WHERE id = $1 AND user_id = $2',
        [uploadId, req.user.id]
      );
      if (!row.rows.length) return res.status(404).json({ error: 'Upload not found' });

      const { path: filePath, mimetype } = row.rows[0];
      const base64 = fs.readFileSync(filePath).toString('base64');

      console.log('[solve] Calling AI with image...');
      result = await callAI('solve', { fileData: { base64, mimeType: mimetype } });
    } else {
      console.log('[solve] Calling AI with text...');
      result = await callAI('solve', { text });
    }

    const { subject, solution } = parseSubjectAndSolution(result);
    console.log('[solve] Subject:', subject, '| Solution length:', solution.length);

    res.json({ solution, subject });
  } catch (err) {
    console.error('[solve] ERROR:', err.message);
    res.status(500).json({ error: err.message || 'Failed to solve problem' });
  }
});

// POST /api/solve/save — save a solution to a folder
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const { folderId, title, problemText, solution, subject } = req.body;
    if (!solution?.trim()) return res.status(400).json({ error: 'solution is required' });

    // If folderId given, verify it belongs to user
    if (folderId) {
      const folder = await pool.query(
        'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
        [folderId, req.user.id]
      );
      if (!folder.rows.length) return res.status(404).json({ error: 'Folder not found' });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO saved_solutions (id, user_id, folder_id, title, problem_text, solution_text, subject)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, folder_id, title, problem_text, solution_text, subject, created_at`,
      [id, req.user.id, folderId || null, title?.trim() || null, problemText?.trim() || null, solution.trim(), subject?.trim() || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[solve/save] ERROR:', err.message);
    res.status(500).json({ error: 'Failed to save solution' });
  }
});

// GET /api/solve/saved — list all saved solutions for user
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, folder_id, title, problem_text, solution_text, subject, created_at
       FROM saved_solutions WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved solutions' });
  }
});

// DELETE /api/solve/saved/:id — delete a saved solution
router.delete('/saved/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM saved_solutions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
