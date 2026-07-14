import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './models/database.js';
import authRoutes from './routes/auth.js';
import studySetsRoutes from './routes/studySets.js';
import uploadsRoutes from './routes/uploads.js';
import generateRoutes from './routes/generate.js';
import progressRoutes from './routes/progress.js';
import foldersRoutes from './routes/folders.js';
import solveRoutes from './routes/solve.js';
import adminRoutes from './routes/admin.js';
import pokemonRoutes from './routes/pokemon.js';
import xpRoutes from './routes/xp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Path to the built frontend
const FRONTEND_DIST = path.join(__dirname, '../../academic-alchemy-ai-main/dist');

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || `http://localhost:${PORT}`,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running' });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/study-sets', studySetsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/solve', solveRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pokemon', pokemonRoutes);
app.use('/api/xp', xpRoutes);

// Serve frontend static files
app.use(express.static(FRONTEND_DIST));

// All non-API routes → serve React app (client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🔄 Initializing database...');
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
