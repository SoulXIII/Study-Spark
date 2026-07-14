import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Sign Up
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    const result = await pool.query(
      `INSERT INTO users (id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, education_level, subjects, daily_goal_minutes, is_pro, pro_since`,
      [userId, name, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        educationLevel: user.education_level,
        subjects: user.subjects || [],
        dailyGoalMinutes: user.daily_goal_minutes,
        isPro: user.is_pro || false,
        proSince: user.pro_since || null,
      },
      token,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user
    const result = await pool.query(
      'SELECT id, name, email, password_hash, education_level, subjects, daily_goal_minutes, is_pro, pro_since, is_admin FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id, user.email, user.is_admin || false);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        educationLevel: user.education_level,
        subjects: user.subjects || [],
        dailyGoalMinutes: user.daily_goal_minutes,
        isPro: user.is_pro || false,
        proSince: user.pro_since || null,
        isAdmin: user.is_admin || false,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get Current User
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, education_level, subjects, daily_goal_minutes, is_pro, pro_since, is_admin FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      educationLevel: user.education_level,
      subjects: user.subjects || [],
      dailyGoalMinutes: user.daily_goal_minutes,
      isPro: user.is_pro || false,
      proSince: user.pro_since || null,
      isAdmin: user.is_admin || false,
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update User
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { name, educationLevel, subjects, dailyGoalMinutes } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (educationLevel !== undefined) {
      updateFields.push(`education_level = $${paramCount++}`);
      values.push(educationLevel);
    }
    if (subjects !== undefined) {
      updateFields.push(`subjects = $${paramCount++}`);
      values.push(subjects);
    }
    if (dailyGoalMinutes !== undefined) {
      updateFields.push(`daily_goal_minutes = $${paramCount++}`);
      values.push(dailyGoalMinutes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.user.id);

    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, education_level, subjects, daily_goal_minutes, is_pro, pro_since`;

    const result = await pool.query(query, values);
    const user = result.rows[0];

    res.json({
      message: 'User updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        educationLevel: user.education_level,
        subjects: user.subjects || [],
        dailyGoalMinutes: user.daily_goal_minutes,
        isPro: user.is_pro || false,
        proSince: user.pro_since || null,
      },
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Cancel Pro subscription
router.delete('/subscription', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET is_pro = FALSE, pro_since = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [req.user.id]
    );
    res.json({ message: 'Subscription cancelled' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Mock Pro Upgrade — validates payment format, always succeeds
router.post('/upgrade', authenticateToken, async (req, res) => {
  try {
    const { cardNumber, expiry, cvv, cardName } = req.body;

    // Validate payment format
    const digits = (cardNumber || '').replace(/\s/g, '');
    if (!/^\d{16}$/.test(digits))
      return res.status(400).json({ error: 'Invalid card number — must be 16 digits' });

    const expiryMatch = (expiry || '').match(/^(\d{2})\/(\d{2})$/);
    if (!expiryMatch)
      return res.status(400).json({ error: 'Invalid expiry — use MM/YY format' });

    const expMonth = parseInt(expiryMatch[1], 10);
    const expYear  = 2000 + parseInt(expiryMatch[2], 10);
    const now = new Date();
    if (expMonth < 1 || expMonth > 12 || new Date(expYear, expMonth - 1) < new Date(now.getFullYear(), now.getMonth()))
      return res.status(400).json({ error: 'Card has expired' });

    if (!/^\d{3,4}$/.test((cvv || '').trim()))
      return res.status(400).json({ error: 'Invalid CVV — must be 3 or 4 digits' });

    if (!cardName || cardName.trim().length < 2)
      return res.status(400).json({ error: 'Cardholder name is required' });

    // Simulate brief processing delay
    await new Promise(r => setTimeout(r, 1200));

    // Mark user as Pro
    const result = await pool.query(
      `UPDATE users SET is_pro = TRUE, pro_since = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, email, education_level, subjects, daily_goal_minutes, is_pro, pro_since`,
      [req.user.id]
    );

    const user = result.rows[0];
    res.json({
      message: 'Upgrade successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        educationLevel: user.education_level,
        subjects: user.subjects || [],
        dailyGoalMinutes: user.daily_goal_minutes,
        isPro: user.is_pro,
        proSince: user.pro_since,
      },
    });
  } catch (err) {
    console.error('Upgrade error:', err);
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

export default router;
