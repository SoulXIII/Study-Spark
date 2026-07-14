import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import { awardXp } from '../utils/xp.js';

const router = express.Router();

// POST /api/progress/log — add minutes to today's daily goal
router.post('/log', authenticateToken, async (req, res) => {
  try {
    const { minutes } = req.body;
    const mins = Math.max(0, Math.round(Number(minutes) || 0));
    if (mins === 0) return res.json({ ok: true });

    const userRes = await pool.query(
      'SELECT daily_goal_minutes FROM users WHERE id = $1',
      [req.user.id]
    );
    const target = userRes.rows[0]?.daily_goal_minutes ?? 30;

    await pool.query(
      `INSERT INTO daily_goals (id, user_id, goal_date, minutes_target, minutes_completed)
       VALUES (gen_random_uuid(), $1, (NOW() AT TIME ZONE 'UTC')::date, $2, $3)
       ON CONFLICT (user_id, goal_date)
       DO UPDATE SET
         minutes_completed = daily_goals.minutes_completed + EXCLUDED.minutes_completed,
         minutes_target    = EXCLUDED.minutes_target,
         updated_at        = CURRENT_TIMESTAMP`,
      [req.user.id, target, mins]
    );

    await awardXp(req.user.id, mins * 5, 'study_time');
    res.json({ ok: true, minutesLogged: mins });
  } catch (err) {
    console.error('Progress log error:', err);
    res.status(500).json({ error: 'Failed to log progress' });
  }
});

// POST /api/progress/complete — record a completed flashcard or quiz session
router.post('/complete', authenticateToken, async (req, res) => {
  try {
    const { studySetId, sessionType = 'flashcard' } = req.body;
    if (!studySetId) return res.status(400).json({ error: 'studySetId required' });

    // Verify study set belongs to user
    const setCheck = await pool.query(
      'SELECT id FROM study_sets WHERE id = $1 AND user_id = $2',
      [studySetId, req.user.id]
    );
    if (!setCheck.rows.length) return res.status(404).json({ error: 'Study set not found' });

    await pool.query(
      `INSERT INTO completed_study_sets (id, user_id, study_set_id, session_type)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [req.user.id, studySetId, sessionType]
    );

    const xpAmount = sessionType === 'quiz' ? 25 : 20;
    await awardXp(req.user.id, xpAmount, `complete_${sessionType}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Progress complete error:', err);
    res.status(500).json({ error: 'Failed to record completion' });
  }
});

// GET /api/progress/today — today's progress + current streak
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const progressRes = await pool.query(
      `SELECT
         u.daily_goal_minutes AS minutes_target,
         COALESCE(dg.minutes_completed, 0) AS minutes_completed
       FROM users u
       LEFT JOIN daily_goals dg
         ON dg.user_id = u.id AND dg.goal_date = (NOW() AT TIME ZONE 'UTC')::date
       WHERE u.id = $1`,
      [req.user.id]
    );

    const streak = await calcStreak(req.user.id);
    const completedRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM completed_study_sets WHERE user_id = $1',
      [req.user.id]
    );
    const row = progressRes.rows[0] ?? { minutes_target: 30, minutes_completed: 0 };
    res.json({ ...row, streak, completed_total: completedRes.rows[0].count });
  } catch (err) {
    console.error('Progress today error:', err);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// GET /api/progress/stats — full stats for profile page
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const [setsRes, cardsRes, completedRes, hoursRes] = await Promise.all([
      pool.query(
        'SELECT COUNT(*)::int AS count FROM study_sets WHERE user_id = $1',
        [req.user.id]
      ),
      pool.query(
        `SELECT COUNT(f.id)::int AS count
         FROM flashcards f
         JOIN study_sets s ON s.id = f.study_set_id
         WHERE s.user_id = $1`,
        [req.user.id]
      ),
      pool.query(
        'SELECT COUNT(*)::int AS count FROM completed_study_sets WHERE user_id = $1',
        [req.user.id]
      ),
      pool.query(
        `SELECT COALESCE(SUM(minutes_completed), 0)::float AS total_minutes
         FROM daily_goals WHERE user_id = $1`,
        [req.user.id]
      ),
    ]);

    const streak = await calcStreak(req.user.id);

    res.json({
      studySetsCount: setsRes.rows[0].count,
      totalCards: cardsRes.rows[0].count,
      completedCount: completedRes.rows[0].count,
      totalHours: Math.round(hoursRes.rows[0].total_minutes / 60 * 10) / 10,
      streak,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ── Streak helper ─────────────────────────────────────────────────────────────
// Count consecutive days (ending today or yesterday) with minutes_completed > 0.
// Uses UTC date strings throughout so timezone differences between the pg driver
// (which returns DATE columns as UTC-midnight Date objects) and new Date() never
// cause a mismatch.
function utcDateStr(d) {
  // Works whether d is already a Date object or a raw date string from pg.
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function calcStreak(userId) {
  const result = await pool.query(
    `SELECT goal_date FROM daily_goals
     WHERE user_id = $1 AND minutes_completed > 0
     ORDER BY goal_date DESC`,
    [userId]
  );

  if (!result.rows.length) return 0;

  const dates = result.rows.map(r => utcDateStr(r.goal_date));

  const now = new Date();
  const todayStr     = utcDateStr(now);
  const yd = new Date(now); yd.setUTCDate(now.getUTCDate() - 1);
  const yesterdayStr = utcDateStr(yd);

  // Streak must include today or yesterday to be active
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(result.rows[i - 1].goal_date);
    prev.setUTCDate(prev.getUTCDate() - 1);
    if (utcDateStr(prev) === dates[i]) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export default router;
