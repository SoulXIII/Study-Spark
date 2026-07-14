import pool from '../config/database.js';

// XP required to advance FROM level N to N+1
export const xpForLevel = (level) => level * 100;

// Cumulative XP to REACH level N (starting at 1)
// Sum of 100*1 + 100*2 + ... + 100*(N-1) = 100 * N*(N-1)/2
export const cumulativeXpForLevel = (level) => 100 * level * (level - 1) / 2;

// Compute current level + progress from raw total XP
export const getLevelInfo = (totalXp) => {
  let level = 1;
  while (cumulativeXpForLevel(level + 1) <= totalXp) level++;
  const xpIntoLevel = totalXp - cumulativeXpForLevel(level);
  const xpNeeded = xpForLevel(level);
  return { level, xpIntoLevel, xpNeeded, totalXp };
};

export const LEVEL_TITLES = [
  [1, 'Rookie'], [5, 'Scholar'], [10, 'Studious'], [15, 'Academic'],
  [20, 'Expert'], [30, 'Master'], [50, 'Grandmaster'], [75, 'Legend'],
];

export const getLevelTitle = (level) => {
  let title = 'Rookie';
  for (const [min, t] of LEVEL_TITLES) { if (level >= min) title = t; }
  return title;
};

export const DUPLICATE_XP = {
  common: 15, uncommon: 30, rare: 75, very_rare: 200, legendary: 500,
};

export const awardXp = async (userId, amount, reason) => {
  if (!amount || amount <= 0) return null;
  const result = await pool.query('SELECT xp FROM users WHERE id = $1', [userId]);
  const currentXp = result.rows[0]?.xp ?? 0;
  const newXp = currentXp + amount;

  const oldInfo = getLevelInfo(currentXp);
  const newInfo = getLevelInfo(newXp);

  await pool.query('UPDATE users SET xp = $1 WHERE id = $2', [newXp, userId]);
  await pool.query(
    'INSERT INTO xp_log (user_id, amount, reason, created_at) VALUES ($1, $2, $3, NOW())',
    [userId, amount, reason]
  );

  return { xpGained: amount, ...newInfo, leveledUp: newInfo.level > oldInfo.level, title: getLevelTitle(newInfo.level) };
};
