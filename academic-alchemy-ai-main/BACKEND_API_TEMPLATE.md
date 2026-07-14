/**
 * Backend API Template Reference
 * 
 * This file shows what endpoints your local database API should implement.
 * You can use any backend framework (Node/Express, Python/Django, Java Spring, etc.)
 * 
 * The important thing is that the endpoints match the URL structure and return
 * the correct TypeScript types defined in src/services/types.ts
 */

// ========== USER ENDPOINTS ==========

/**
 * GET /api/users/me
 * Get current logged-in user
 * 
 * Response: User
 * {
 *   id: string
 *   name: string
 *   email: string
 *   avatar?: string
 *   streak: number
 *   totalMinutesStudied: number
 * }
 */
export const getUserProfile = () => {
  // Fetch from database and return current user
};

/**
 * GET /api/study-sets
 * Get all study sets for a user
 * 
 * Query Params:
 *   - userId?: string (filter by user)
 * 
 * Response: StudySet[]
 */
export const getStudySets = () => {
  // Fetch from database and filter by userId if provided
};

/**
 * GET /api/study-sets/:id
 * Get a specific study set
 * 
 * Response: StudySet
 */
export const getStudySet = () => {
  // Fetch specific study set by ID
};

/**
 * POST /api/study-sets
 * Create a new study set
 * 
 * Body: Omit<StudySet, "id">
 * Response: StudySet (with generated id)
 */
export const createStudySet = () => {
  // Create new study set in database
};

/**
 * PUT /api/study-sets/:id
 * Update a study set
 * 
 * Body: Partial<StudySet>
 * Response: StudySet (updated)
 */
export const updateStudySet = () => {
  // Update study set in database
};

/**
 * DELETE /api/study-sets/:id
 * Delete a study set
 * 
 * Response: { success: true }
 */
export const deleteStudySet = () => {
  // Delete study set from database
};

// ========== FOLDER ENDPOINTS ==========

/**
 * GET /api/folders
 * Get all folders for a user
 * 
 * Query Params:
 *   - userId?: string (filter by user)
 * 
 * Response: Folder[]
 */
export const getFolders = () => {
  // Fetch folders from database
};

/**
 * GET /api/folders/:id
 * Get a specific folder
 * 
 * Response: Folder
 */
export const getFolder = () => {
  // Fetch specific folder by ID
};

// ========== FLASHCARD ENDPOINTS ==========

/**
 * GET /api/flashcards
 * Get flashcards for a study set
 * 
 * Query Params:
 *   - setId: string (required)
 * 
 * Response: Flashcard[]
 */
export const getFlashcards = () => {
  // Fetch flashcards filtered by setId
};

/**
 * POST /api/flashcards
 * Create a new flashcard
 * 
 * Body: Omit<Flashcard, "id">
 * Response: Flashcard (with generated id)
 */
export const createFlashcard = () => {
  // Create new flashcard in database
};

/**
 * PUT /api/flashcards/:id
 * Update a flashcard
 * 
 * Body: Partial<Flashcard>
 * Response: Flashcard (updated)
 */
export const updateFlashcard = () => {
  // Update flashcard in database
};

/**
 * DELETE /api/flashcards/:id
 * Delete a flashcard
 * 
 * Response: { success: true }
 */
export const deleteFlashcard = () => {
  // Delete flashcard from database
};

// ========== QUIZ ENDPOINTS ==========

/**
 * GET /api/quiz-questions
 * Get quiz questions for a study set
 * 
 * Query Params:
 *   - setId: string (required)
 * 
 * Response: QuizQuestion[]
 */
export const getQuizQuestions = () => {
  // Fetch quiz questions filtered by setId
};

/**
 * POST /api/quiz-questions
 * Create a new quiz question
 * 
 * Body: Omit<QuizQuestion, "id">
 * Response: QuizQuestion (with generated id)
 */
export const createQuizQuestion = () => {
  // Create new quiz question in database
};

// ========== PROBLEM ENDPOINTS ==========

/**
 * GET /api/problems
 * Get problems for a study set
 * 
 * Query Params:
 *   - setId: string (required)
 * 
 * Response: Problem[]
 */
export const getProblems = () => {
  // Fetch problems filtered by setId
};

/**
 * GET /api/problems/:id
 * Get a specific problem
 * 
 * Response: Problem
 */
export const getProblem = () => {
  // Fetch specific problem by ID
};

// ========== DAILY GOAL ENDPOINTS ==========

/**
 * GET /api/daily-goals/:userId
 * Get daily goal progress for a user
 * 
 * Response: DailyGoal
 * {
 *   userId: string
 *   minutesTarget: number
 *   minutesCompleted: number
 *   percentComplete: number
 * }
 */
export const getDailyGoal = () => {
  // Fetch daily goal from database
};

/**
 * PUT /api/daily-goals/:userId
 * Update daily goal progress
 * 
 * Body: Partial<DailyGoal>
 * Response: DailyGoal (updated)
 */
export const updateDailyGoal = () => {
  // Update daily goal in database
};

// ========== EXAMPLE EXPRESS.JS IMPLEMENTATION ==========

/*
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({
  origin: "http://localhost:8080",
  credentials: true
}));
app.use(express.json());

// Example: GET /api/users/me
app.get('/api/users/me', (req, res) => {
  // Get user from database or session
  res.json({
    id: "user-1",
    name: "John Doe",
    email: "john@example.com",
    streak: 7,
    totalMinutesStudied: 420
  });
});

// Example: GET /api/study-sets
app.get('/api/study-sets', async (req, res) => {
  const { userId } = req.query;
  
  // Query database for study sets
  const studySets = await db.findStudySets(userId);
  res.json(studySets);
});

// Example: POST /api/study-sets
app.post('/api/study-sets', async (req, res) => {
  const newSet = await db.createStudySet(req.body);
  res.json(newSet);
});

app.listen(5000, () => {
  console.log('API running on http://localhost:5000');
});
*/
