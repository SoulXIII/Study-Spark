import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();
// All admin routes require a valid token AND is_admin = true
router.use(authenticateToken, requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, proUsers, studySets, flashcards, quizQuestions, solutions, todaySignups] =
      await Promise.all([
        pool.query('SELECT COUNT(*)::int AS n FROM users'),
        pool.query('SELECT COUNT(*)::int AS n FROM users WHERE is_pro = TRUE'),
        pool.query('SELECT COUNT(*)::int AS n FROM study_sets'),
        pool.query('SELECT COUNT(*)::int AS n FROM flashcards'),
        pool.query('SELECT COUNT(*)::int AS n FROM quiz_questions'),
        pool.query('SELECT COUNT(*)::int AS n FROM saved_solutions'),
        pool.query("SELECT COUNT(*)::int AS n FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'"),
      ]);
    res.json({
      totalUsers:      users.rows[0].n,
      proUsers:        proUsers.rows[0].n,
      totalStudySets:  studySets.rows[0].n,
      totalFlashcards: flashcards.rows[0].n,
      totalQuestions:  quizQuestions.rows[0].n,
      totalSolutions:  solutions.rows[0].n,
      todaySignups:    todaySignups.rows[0].n,
    });
  } catch (err) {
    console.error('[admin/stats]', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search = '' } = req.query;
    const result = await pool.query(
      `SELECT id, name, email, education_level, daily_goal_minutes,
              is_pro, pro_since, is_admin, created_at,
              (SELECT COUNT(*)::int FROM study_sets WHERE user_id = users.id) AS study_set_count
       FROM users
       WHERE ($1 = '' OR name ILIKE $2 OR email ILIKE $2)
       ORDER BY created_at DESC
       LIMIT 200`,
      [search, `%${search}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/users]', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── PATCH /api/admin/users/:id — toggle pro / admin ──────────────────────────
router.patch('/users/:id', async (req, res) => {
  try {
    const { isPro, isAdmin } = req.body;
    const fields = [];
    const vals = [];
    let i = 1;
    if (isPro !== undefined) { fields.push(`is_pro = $${i++}`); vals.push(isPro); }
    if (isAdmin !== undefined) { fields.push(`is_admin = $${i++}`); vals.push(isAdmin); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

    // Prevent demoting yourself
    if (req.params.id === req.user.id && isAdmin === false) {
      return res.status(400).json({ error: 'Cannot remove your own admin rights' });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    vals.push(req.params.id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, email, is_pro, is_admin`,
      vals
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[admin/users/patch]', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account from admin panel' });
    }
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('[admin/users/delete]', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── GET /api/admin/study-sets ─────────────────────────────────────────────────
router.get('/study-sets', async (req, res) => {
  try {
    const { search = '' } = req.query;
    const result = await pool.query(
      `SELECT s.id, s.title, s.subject, s.created_at,
              u.name AS owner_name, u.email AS owner_email,
              (SELECT COUNT(*)::int FROM flashcards WHERE study_set_id = s.id) AS card_count
       FROM study_sets s
       JOIN users u ON u.id = s.user_id
       WHERE ($1 = '' OR s.title ILIKE $2 OR u.email ILIKE $2)
       ORDER BY s.created_at DESC
       LIMIT 200`,
      [search, `%${search}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/study-sets]', err.message);
    res.status(500).json({ error: 'Failed to fetch study sets' });
  }
});

// ── DELETE /api/admin/study-sets/:id ─────────────────────────────────────────
router.delete('/study-sets/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM study_sets WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Study set not found' });
    res.json({ message: 'Study set deleted' });
  } catch (err) {
    console.error('[admin/study-sets/delete]', err.message);
    res.status(500).json({ error: 'Failed to delete study set' });
  }
});

// ── GET /api/admin/solutions ──────────────────────────────────────────────────
router.get('/solutions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ss.id, ss.title, ss.subject, ss.created_at,
              u.name AS owner_name, u.email AS owner_email,
              f.name AS folder_name
       FROM saved_solutions ss
       JOIN users u ON u.id = ss.user_id
       LEFT JOIN folders f ON f.id = ss.folder_id
       ORDER BY ss.created_at DESC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/solutions]', err.message);
    res.status(500).json({ error: 'Failed to fetch solutions' });
  }
});

// ── DELETE /api/admin/solutions/:id ──────────────────────────────────────────
router.delete('/solutions/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM saved_solutions WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
