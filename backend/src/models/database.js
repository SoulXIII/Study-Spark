import pool from '../config/database.js';

export const initializeDatabase = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        education_level VARCHAR(50),
        subjects TEXT[],
        daily_goal_minutes INTEGER DEFAULT 30,
        is_pro BOOLEAN DEFAULT FALSE,
        pro_since TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Migrate existing tables that may not have is_pro yet
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_since TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0`);

    // Study Sets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS study_sets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        subject VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Flashcards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS flashcards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        difficulty VARCHAR(20) DEFAULT 'medium',
        times_correct INTEGER DEFAULT 0,
        times_attempted INTEGER DEFAULT 0,
        easiness_factor FLOAT DEFAULT 2.5,
        repetitions INTEGER DEFAULT 0,
        interval_days INTEGER DEFAULT 1,
        next_review_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // SM-2 column migrations for existing tables
    await client.query(`ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS easiness_factor FLOAT DEFAULT 2.5`);
    await client.query(`ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS repetitions INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS interval_days INTEGER DEFAULT 1`);
    await client.query(`ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS next_review_date DATE DEFAULT CURRENT_DATE`);

    // Quiz Questions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        options TEXT[] NOT NULL,
        correct_option_index INTEGER NOT NULL,
        explanation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Folders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Folder Study Sets (Junction table for many-to-many)
    await client.query(`
      CREATE TABLE IF NOT EXISTS folder_study_sets (
        folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
        PRIMARY KEY (folder_id, study_set_id)
      )
    `);

    // Problems table
    await client.query(`
      CREATE TABLE IF NOT EXISTS problems (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        solution TEXT,
        subject VARCHAR(100),
        difficulty VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Daily Goals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        goal_date DATE DEFAULT (NOW() AT TIME ZONE 'UTC')::date,
        minutes_target INTEGER NOT NULL,
        minutes_completed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, goal_date)
      )
    `);

    // Completed study set sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS completed_study_sets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        study_set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
        session_type VARCHAR(20) DEFAULT 'flashcard',
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_completed_user_id ON completed_study_sets(user_id)`);

    // Saved Solutions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_solutions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
        title VARCHAR(255),
        problem_text TEXT,
        solution_text TEXT NOT NULL,
        subject VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_saved_solutions_user_id ON saved_solutions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_saved_solutions_folder_id ON saved_solutions(folder_id)`);

    // Uploads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        original_name VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        mimetype VARCHAR(100) NOT NULL,
        size INTEGER NOT NULL,
        path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Pokemon collection
    await client.query(`
      CREATE TABLE IF NOT EXISTS pokemon_collection (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pokemon_id INTEGER NOT NULL,
        rarity VARCHAR(20) NOT NULL,
        caught_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, pokemon_id)
      )
    `);

    // Daily quest progress
    await client.query(`
      CREATE TABLE IF NOT EXISTS pokemon_quests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quest_type VARCHAR(50) NOT NULL,
        quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
        progress INTEGER DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        roll_claimed BOOLEAN DEFAULT FALSE,
        UNIQUE(user_id, quest_type, quest_date)
      )
    `);

    // Pity counter + companion selection
    await client.query(`
      CREATE TABLE IF NOT EXISTS pokemon_roll_stats (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        rolls_since_legendary INTEGER DEFAULT 0,
        total_rolls INTEGER DEFAULT 0,
        companion_pokemon_id INTEGER
      )
    `);
    await client.query(`ALTER TABLE pokemon_roll_stats ADD COLUMN IF NOT EXISTS admin_legendary_used BOOLEAN DEFAULT FALSE`);

    // XP log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS xp_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        reason VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_xp_log_user_id ON xp_log(user_id)`);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_study_sets_user_id ON study_sets(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flashcards_study_set_id ON flashcards(study_set_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_quiz_questions_study_set_id ON quiz_questions(study_set_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_problems_user_id ON problems(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_daily_goals_user_id ON daily_goals(user_id)`);

    await client.query('COMMIT');
    console.log('✅ Database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database initialization error:', err);
    throw err;
  } finally {
    client.release();
  }
};
