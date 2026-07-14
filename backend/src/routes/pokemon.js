import express from 'express';
import dbPool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { awardXp, DUPLICATE_XP } from '../utils/xp.js';

const router = express.Router();

// ── Rarity classification for Gen 1–5 (IDs 1–649) ───────────────────────────

const LEGENDARY_IDS = new Set([
  144,145,146,150,151,
  243,244,245,249,250,251,
  377,378,379,380,381,382,383,384,385,386,
  480,481,482,483,484,485,486,487,488,489,490,491,492,493,
  494,638,639,640,641,642,643,644,645,646,647,648,649,
]);

const VERY_RARE_IDS = new Set([
  3,6,9,94,130,131,143,149,
  196,197,229,230,248,
  350,373,376,
  445,448,461,468,471,473,477,
  571,609,612,635,637,
]);

const RARE_IDS = new Set([
  34,65,68,71,76,80,89,91,103,105,110,112,113,115,
  121,122,123,124,125,126,127,128,132,134,135,136,138,139,140,141,142,
  154,157,160,169,176,181,182,184,186,195,198,199,200,
  206,208,210,212,214,217,219,221,224,232,234,237,241,242,
  257,260,282,306,310,319,330,334,338,344,348,357,359,362,365,368,371,375,
  392,395,398,405,407,409,411,416,419,423,426,430,432,
  435,437,442,444,452,455,457,460,462,463,464,465,466,
  467,469,470,474,475,476,478,479,
  497,500,503,508,512,516,521,526,530,534,537,542,545,
  549,553,555,559,561,567,569,573,579,584,591,596,598,604,606,617,620,623,626,632,
]);

const getRarity = (id) => {
  if (LEGENDARY_IDS.has(id)) return 'legendary';
  if (VERY_RARE_IDS.has(id)) return 'very_rare';
  if (RARE_IDS.has(id)) return 'rare';
  return id % 3 === 0 ? 'uncommon' : 'common';
};

// Build per-rarity pools once at startup
const POOLS = { legendary: [], very_rare: [], rare: [], uncommon: [], common: [] };
for (let i = 1; i <= 649; i++) POOLS[getRarity(i)].push(i);

// ── Quest definitions ────────────────────────────────────────────────────────

const QUESTS = [
  { type: 'study_15min',   title: 'Study for 15 minutes', description: 'Spend 15 min in Flashcard or Quiz mode', icon: '📚', target: 15 },
  { type: 'complete_quiz', title: 'Complete a quiz',       description: 'Finish any quiz from start to finish',  icon: '✅', target: 1  },
  { type: 'create_set',    title: 'Create a study set',    description: 'Generate a new study set',               icon: '🧠', target: 1  },
  { type: 'flip_10',       title: 'Flip 10 flashcards',    description: 'Review 10 flashcards',                   icon: '🃏', target: 10 },
];

const QUEST_MAP = Object.fromEntries(QUESTS.map(q => [q.type, q]));

// ── Gacha helpers ────────────────────────────────────────────────────────────

const rollRarity = (pityCount) => {
  if (pityCount >= 30) return 'legendary';
  const r = Math.random();
  if (r < 0.01) return 'legendary';
  if (r < 0.05) return 'very_rare';
  if (r < 0.17) return 'rare';
  if (r < 0.45) return 'uncommon';
  return 'common';
};

const pickPokemon = async (rarity, userId) => {
  const rarityPool = POOLS[rarity];
  const result = await dbPool.query(
    'SELECT pokemon_id FROM pokemon_collection WHERE user_id = $1',
    [userId]
  );
  const owned = new Set(result.rows.map(r => r.pokemon_id));
  const available = rarityPool.filter(id => !owned.has(id));
  const candidates = available.length > 0 ? available : rarityPool;
  const pokemonId = candidates[Math.floor(Math.random() * candidates.length)];
  return { pokemonId, isDuplicate: owned.has(pokemonId) };
};

const performRoll = async (userId) => {
  // Ensure roll stats row exists
  await dbPool.query(
    `INSERT INTO pokemon_roll_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [userId]
  );
  const statsRow = await dbPool.query(
    'SELECT rolls_since_legendary, total_rolls FROM pokemon_roll_stats WHERE user_id = $1',
    [userId]
  );
  const { rolls_since_legendary, total_rolls } = statsRow.rows[0];

  const rarity = rollRarity(rolls_since_legendary);
  const { pokemonId, isDuplicate } = await pickPokemon(rarity, userId);

  const isLegendary = rarity === 'legendary';

  // Update roll stats
  await dbPool.query(
    `UPDATE pokemon_roll_stats
     SET rolls_since_legendary = $1, total_rolls = total_rolls + 1
     WHERE user_id = $2`,
    [isLegendary ? 0 : rolls_since_legendary + 1, userId]
  );

  let xpGained = 0;
  if (!isDuplicate) {
    await dbPool.query(
      `INSERT INTO pokemon_collection (id, user_id, pokemon_id, rarity)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [uuidv4(), userId, pokemonId, rarity]
    );
  } else {
    // Duplicates convert to XP
    const xpResult = await awardXp(userId, DUPLICATE_XP[rarity], `duplicate_${rarity}`);
    xpGained = xpResult?.xpGained ?? 0;
  }

  return { pokemonId, rarity, isDuplicate, xpGained, totalRolls: total_rolls + 1, pityCount: isLegendary ? 0 : rolls_since_legendary + 1 };
};

// ── GET /api/pokemon/quests ──────────────────────────────────────────────────

router.get('/quests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Upsert all 4 quests for today
    for (const q of QUESTS) {
      await dbPool.query(
        `INSERT INTO pokemon_quests (id, user_id, quest_type, quest_date)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [uuidv4(), userId, q.type, today]
      );
    }

    const rows = await dbPool.query(
      `SELECT quest_type, progress, completed, roll_claimed
       FROM pokemon_quests WHERE user_id = $1 AND quest_date = $2`,
      [userId, today]
    );

    const quests = QUESTS.map(q => {
      const row = rows.rows.find(r => r.quest_type === q.type) || {};
      return {
        ...q,
        progress: row.progress || 0,
        completed: row.completed || false,
        rollClaimed: row.roll_claimed || false,
      };
    });

    // Roll stats for pity display
    const statsRow = await dbPool.query(
      'SELECT rolls_since_legendary, total_rolls FROM pokemon_roll_stats WHERE user_id = $1',
      [userId]
    );
    const stats = statsRow.rows[0] || { rolls_since_legendary: 0, total_rolls: 0 };

    res.json({ quests, pityCount: stats.rolls_since_legendary, totalRolls: stats.total_rolls });
  } catch (err) {
    console.error('[pokemon] quests error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pokemon/quests/progress ───────────────────────────────────────
// Body: { questType, increment }
// Returns: { quest, completedNow, roll? }

router.post('/quests/progress', authenticateToken, async (req, res) => {
  try {
    const { questType, increment = 1 } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const questDef = QUEST_MAP[questType];
    if (!questDef) return res.status(400).json({ error: 'Unknown quest type' });

    // Upsert quest row
    await dbPool.query(
      `INSERT INTO pokemon_quests (id, user_id, quest_type, quest_date)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [uuidv4(), userId, questType, today]
    );

    // Get current state
    const current = await dbPool.query(
      'SELECT progress, completed, roll_claimed FROM pokemon_quests WHERE user_id=$1 AND quest_type=$2 AND quest_date=$3',
      [userId, questType, today]
    );
    const row = current.rows[0];

    // Already completed and claimed — nothing to do
    if (row.completed && row.roll_claimed) {
      return res.json({ quest: { ...questDef, progress: row.progress, completed: true, rollClaimed: true }, completedNow: false });
    }

    const newProgress = Math.min(row.progress + increment, questDef.target * 2);
    const completedNow = !row.completed && newProgress >= questDef.target;

    await dbPool.query(
      `UPDATE pokemon_quests
       SET progress = $1, completed = $2
       WHERE user_id=$3 AND quest_type=$4 AND quest_date=$5`,
      [newProgress, row.completed || completedNow, userId, questType, today]
    );

    res.json({
      quest: { ...questDef, progress: newProgress, completed: row.completed || completedNow, rollClaimed: row.roll_claimed },
      completedNow,
    });
  } catch (err) {
    console.error('[pokemon] progress error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pokemon/quests/claim ──────────────────────────────────────────
// Body: { questType }  — performs roll for a completed unclaimed quest

router.post('/quests/claim', authenticateToken, async (req, res) => {
  try {
    const { questType } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const current = await dbPool.query(
      'SELECT progress, completed, roll_claimed FROM pokemon_quests WHERE user_id=$1 AND quest_type=$2 AND quest_date=$3',
      [userId, questType, today]
    );
    const row = current.rows[0];
    if (!row) return res.status(404).json({ error: 'Quest not found' });
    if (!row.completed) return res.status(400).json({ error: 'Quest not completed yet' });
    if (row.roll_claimed) return res.status(400).json({ error: 'Already claimed' });

    await dbPool.query(
      'UPDATE pokemon_quests SET roll_claimed = true WHERE user_id=$1 AND quest_type=$2 AND quest_date=$3',
      [userId, questType, today]
    );

    const roll = await performRoll(userId);
    const xpResult = await awardXp(userId, 50, 'quest_complete');
    res.json({ roll, xpGained: xpResult?.xpGained ?? 0, leveledUp: xpResult?.leveledUp ?? false, level: xpResult?.level });
  } catch (err) {
    console.error('[pokemon] claim error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pokemon/admin/roll — test roll for admins only ────────────────

router.post('/admin/roll', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admins only' });
    const roll = await performRoll(req.user.id);
    res.json({ roll });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/pokemon/admin/legendary — one-time guaranteed legendary ────────

router.post('/admin/legendary', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admins only' });

    await dbPool.query(
      `INSERT INTO pokemon_roll_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [req.user.id]
    );
    const statsRow = await dbPool.query(
      'SELECT admin_legendary_used FROM pokemon_roll_stats WHERE user_id = $1',
      [req.user.id]
    );
    if (statsRow.rows[0]?.admin_legendary_used) {
      return res.status(400).json({ error: 'Already used' });
    }

    // Force legendary rarity
    const { pokemonId, isDuplicate } = await pickPokemon('legendary', req.user.id);
    if (!isDuplicate) {
      await dbPool.query(
        `INSERT INTO pokemon_collection (id, user_id, pokemon_id, rarity)
         VALUES ($1, $2, $3, 'legendary') ON CONFLICT DO NOTHING`,
        [uuidv4(), req.user.id, pokemonId]
      );
    }
    await dbPool.query(
      `UPDATE pokemon_roll_stats SET admin_legendary_used = TRUE, rolls_since_legendary = 0 WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({ roll: { pokemonId, rarity: 'legendary', isDuplicate, xpGained: 0, pityCount: 0 }, used: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/pokemon/admin/legendary-status ──────────────────────────────────

router.get('/admin/legendary-status', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admins only' });
    await dbPool.query(
      `INSERT INTO pokemon_roll_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [req.user.id]
    );
    const row = await dbPool.query(
      'SELECT admin_legendary_used FROM pokemon_roll_stats WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ used: row.rows[0]?.admin_legendary_used ?? false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/pokemon/collection ─────────────────────────────────────────────

router.get('/collection', authenticateToken, async (req, res) => {
  try {
    const result = await dbPool.query(
      'SELECT pokemon_id, rarity, caught_at FROM pokemon_collection WHERE user_id=$1 ORDER BY caught_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/pokemon/stats ───────────────────────────────────────────────────

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    await dbPool.query(
      `INSERT INTO pokemon_roll_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [req.user.id]
    );
    const result = await dbPool.query(
      'SELECT rolls_since_legendary, total_rolls, companion_pokemon_id FROM pokemon_roll_stats WHERE user_id=$1',
      [req.user.id]
    );
    const collectionCount = await dbPool.query(
      'SELECT COUNT(*) FROM pokemon_collection WHERE user_id=$1',
      [req.user.id]
    );
    res.json({
      ...result.rows[0],
      collectionCount: parseInt(collectionCount.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/pokemon/companion/:pokemonId ───────────────────────────────────

router.put('/companion/:pokemonId', authenticateToken, async (req, res) => {
  try {
    const pokemonId = parseInt(req.params.pokemonId);
    if (!pokemonId || pokemonId < 1 || pokemonId > 649) return res.status(400).json({ error: 'Invalid pokemon ID' });

    // Verify user owns it
    const owns = await dbPool.query(
      'SELECT id FROM pokemon_collection WHERE user_id=$1 AND pokemon_id=$2',
      [req.user.id, pokemonId]
    );
    if (!owns.rows.length) return res.status(403).json({ error: 'You do not own this Pokemon' });

    await dbPool.query(
      `INSERT INTO pokemon_roll_stats (user_id, companion_pokemon_id) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET companion_pokemon_id = $2`,
      [req.user.id, pokemonId]
    );
    res.json({ companionPokemonId: pokemonId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
