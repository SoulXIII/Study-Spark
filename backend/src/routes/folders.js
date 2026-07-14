import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// GET /api/folders — list all folders with set count + solution count
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, f.name, f.description, f.created_at,
              COUNT(DISTINCT fs.study_set_id)::int AS set_count,
              COUNT(DISTINCT ss.id)::int AS solution_count
       FROM folders f
       LEFT JOIN folder_study_sets fs ON fs.folder_id = f.id
       LEFT JOIN saved_solutions ss ON ss.folder_id = f.id
       WHERE f.user_id = $1
       GROUP BY f.id
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get folders error:', err);
    res.status(500).json({ error: 'Failed to get folders' });
  }
});

// GET /api/folders/:id — single folder with its study sets
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const folder = await pool.query(
      'SELECT id, name, description, created_at FROM folders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!folder.rows.length) return res.status(404).json({ error: 'Folder not found' });

    const sets = await pool.query(
      `SELECT s.id, s.title, s.subject, s.updated_at,
              (SELECT COUNT(*) FROM flashcards WHERE study_set_id = s.id)::int AS card_count
       FROM study_sets s
       JOIN folder_study_sets fs ON fs.study_set_id = s.id
       WHERE fs.folder_id = $1
       ORDER BY s.updated_at DESC`,
      [req.params.id]
    );

    res.json({ ...folder.rows[0], study_sets: sets.rows });
  } catch (err) {
    console.error('Get folder error:', err);
    res.status(500).json({ error: 'Failed to get folder' });
  }
});

// POST /api/folders — create folder
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Folder name is required' });

    const result = await pool.query(
      `INSERT INTO folders (id, user_id, name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, created_at`,
      [uuidv4(), req.user.id, name.trim(), description?.trim() || null]
    );
    res.status(201).json({ ...result.rows[0], set_count: 0 });
  } catch (err) {
    console.error('Create folder error:', err);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// PUT /api/folders/:id — rename folder
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      `UPDATE folders SET name = COALESCE($2, name), description = COALESCE($3, description),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $4
       RETURNING id, name, description, created_at`,
      [req.params.id, name?.trim(), description?.trim(), req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Folder not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update folder error:', err);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// DELETE /api/folders/:id — delete folder
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM folders WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Folder not found' });
    res.json({ message: 'Folder deleted' });
  } catch (err) {
    console.error('Delete folder error:', err);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// GET /api/folders/:id/solutions — list saved solutions in a folder
router.get('/:id/solutions', authenticateToken, async (req, res) => {
  try {
    const folder = await pool.query(
      'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!folder.rows.length) return res.status(404).json({ error: 'Folder not found' });

    const result = await pool.query(
      `SELECT id, title, problem_text, solution_text, subject, created_at
       FROM saved_solutions WHERE folder_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [req.params.id, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch solutions' });
  }
});

// POST /api/folders/:id/study-sets — add a study set to folder
router.post('/:id/study-sets', authenticateToken, async (req, res) => {
  try {
    const { studySetId } = req.body;
    if (!studySetId) return res.status(400).json({ error: 'studySetId is required' });

    // Verify folder belongs to user
    const folder = await pool.query(
      'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!folder.rows.length) return res.status(404).json({ error: 'Folder not found' });

    // Verify study set belongs to user
    const set = await pool.query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [studySetId, req.user.id]
    );
    if (!set.rows.length) return res.status(404).json({ error: 'Study set not found' });

    await pool.query(
      'INSERT INTO folder_study_sets (folder_id, study_set_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, studySetId]
    );
    res.json({ message: 'Study set added to folder' });
  } catch (err) {
    console.error('Add to folder error:', err);
    res.status(500).json({ error: 'Failed to add study set to folder' });
  }
});

// DELETE /api/folders/:id/study-sets/:setId — remove study set from folder
router.delete('/:id/study-sets/:setId', authenticateToken, async (req, res) => {
  try {
    const folder = await pool.query(
      'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!folder.rows.length) return res.status(404).json({ error: 'Folder not found' });

    await pool.query(
      'DELETE FROM folder_study_sets WHERE folder_id = $1 AND study_set_id = $2',
      [req.params.id, req.params.setId]
    );
    res.json({ message: 'Study set removed from folder' });
  } catch (err) {
    console.error('Remove from folder error:', err);
    res.status(500).json({ error: 'Failed to remove study set from folder' });
  }
});

export default router;
