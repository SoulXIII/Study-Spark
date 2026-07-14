import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { getLevelInfo, getLevelTitle } from '../utils/xp.js';

const router = express.Router();

// GET /api/xp/profile — level info + recent log
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userRes = await pool.query('SELECT xp FROM users WHERE id = $1', [req.user.id]);
    const totalXp = userRes.rows[0]?.xp ?? 0;
    const info = getLevelInfo(totalXp);

    const logRes = await pool.query(
      'SELECT amount, reason, created_at FROM xp_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [req.user.id]
    );

    res.json({ ...info, title: getLevelTitle(info.level), log: logRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
