# Complete Database Setup Guide - StudySpark

## System Architecture

```
Frontend (React + TypeScript)  ←→  Backend (Express)  ←→  PostgreSQL Database
  :8080                            :5000                     :5432
```

## Complete Step-by-Step Setup

### PHASE 1: PostgreSQL Setup

#### Windows
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run installer, keep default settings
3. Remember the password you set for `postgres` user
4. Open **SQL Shell (psql)** from Start Menu
5. Enter password when prompted
6. Create database:
```sql
CREATE DATABASE studyspark;
\l  -- list databases to verify
```

#### Mac
```bash
brew install postgresql@15
brew services start postgresql@15
createdb studyspark
```

#### Linux (Ubuntu)
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb studyspark
```

### PHASE 2: Backend Setup

1. **Navigate to backend folder:**
```bash
cd c:\StudySpark\backend
```

2. **Install dependencies:**
```bash
npm install
```

Expected packages:
- express, pg, dotenv, bcryptjs, jsonwebtoken, cors, uuid

3. **Create `.env` file (copy from `.env.example`):**
```bash
# Windows PowerShell
Copy-Item .env.example .env

# Mac/Linux
cp .env.example .env
```

4. **Edit `.env` with your database credentials:**
```env
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD
DB_HOST=localhost
DB_PORT=5432
DB_NAME=studyspark
JWT_SECRET=your-super-secret-key-12345
PORT=5000
FRONTEND_URL=http://localhost:8080
NODE_ENV=development
```

5. **Verify database connection:**
```bash
# On Windows: Open new PowerShell
psql -U postgres -d studyspark -c "SELECT 1"

# Should return: 1
```

6. **Start backend server:**
```bash
npm run dev
```

Expected output:
```
🔄 Initializing database...
✅ Database initialized successfully
✅ Server running on http://localhost:5000
📡 API available at http://localhost:5000/api
```

### PHASE 3: Test Backend (Before Frontend)

**In another terminal, test the API:**

```bash
# Test health check
curl http://localhost:5000/health

# Test sign up
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

Expected response:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid-here",
    "name": "Test User",
    "email": "test@example.com",
    ...
  },
  "token": "eyJhbGc..."
}
```

Save the token for next test.

```bash
# Test login (use token from signup)
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### PHASE 4: Frontend Configuration

1. **Update frontend `.env`:**

Edit `academic-alchemy-ai-main/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

2. **Update `src/context/AuthContext.tsx`:**

Add token saving to localStorage:
```typescript
const login = async (email: string, password: string, name?: string) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (data.user && data.token) {
      setUser(data.user);
      setIsLoggedIn(true);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);  // ← NEW
    }
  } catch (err) {
    console.error('Login failed:', err);
  }
};

const logout = () => {
  setUser(null);
  setIsLoggedIn(false);
  localStorage.removeItem('user');
  localStorage.removeItem('token');  // ← NEW
};
```

3. **Start frontend:**
```bash
cd academic-alchemy-ai-main
npm run dev
```

### PHASE 5: End-to-End Testing

1. **Test Sign Up Flow:**
   - Open http://localhost:8080/signup
   - Fill in form: John Doe, john@example.com, password123
   - Click Sign Up
   - Check browser console (F12 → Console)
   - Should see token in localStorage
   - Should redirect to /onboarding

2. **Test Login Flow:**
   - Close browser or go to /login
   - Enter same credentials
   - Should redirect to home (/)
   - Greeting should display with current time emoji

3. **Verify Database:**
```bash
# In new terminal
psql -U postgres -d studyspark

# In psql:
SELECT * FROM users;  -- Should see John Doe
```

### PHASE 6: Next Steps - Create More API Routes

Create routes for remaining features:

**File: `backend/src/routes/flashcards.js`**
- GET /api/flashcards/:studySetId
- POST /api/flashcards
- PUT /api/flashcards/:id
- DELETE /api/flashcards/:id

**File: `backend/src/routes/quizzes.js`**
- GET /api/quiz-questions/:studySetId
- POST /api/quiz-questions
- PUT /api/quiz-questions/:id

**File: `backend/src/routes/folders.js`**
- GET /api/folders
- POST /api/folders
- DELETE /api/folders/:id

Follow the same pattern as `studySets.js` - use authenticateToken middleware, query database, return JSON.

## Troubleshooting Guide

| Problem | Solution |
|---------|----------|
| `ECONNREFUSED` at localhost:5432 | PostgreSQL not running. Start it from Services (Windows) or `brew services start postgresql` (Mac) |
| "password authentication failed" | Wrong DB password in `.env`. Verify with `psql -U postgres` |
| "database does not exist" | Create it: `createdb studyspark` |
| Port 5000 already in use | Change `PORT` in `.env` or kill: `lsof -ti:5000 \| xargs kill -9` |
| CORS errors in frontend | Check `FRONTEND_URL` in backend `.env` matches your frontend URL |
| "JWT_SECRET is missing" | Add valid `JWT_SECRET` to `.env` |
| Token not persisting | Check localStorage is enabled in browser |
| Login works but no redirect | Check AuthContext logout is clearing token |

## File Structure

```
StudySpark/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          ← PostgreSQL connection
│   │   ├── middleware/
│   │   │   └── auth.js              ← JWT authentication
│   │   ├── models/
│   │   │   └── database.js          ← Schema initialization
│   │   ├── routes/
│   │   │   ├── auth.js              ← Sign up, login, user
│   │   │   └── studySets.js         ← CRUD for study sets
│   │   └── index.js                 ← Express server
│   ├── .env                         ← Configuration (create from .env.example)
│   ├── .env.example                 ← Template
│   ├── package.json                 ← Dependencies
│   ├── README.md                    ← Backend documentation
│   └── FRONTEND_CONNECTION.md       ← Integration guide
│
└── academic-alchemy-ai-main/
    ├── src/
    │   ├── context/
    │   │   └── AuthContext.tsx      ← Save token to localStorage
    │   ├── services/
    │   │   └── api.ts               ← Add token to requests
    │   └── pages/
    │       ├── Login.tsx
    │       ├── SignUp.tsx
    │       └── Index.tsx
    └── .env                         ← VITE_API_URL=http://localhost:5000/api
```

## Database Schema Overview

**users** - User accounts with auth
- id (UUID)
- email (unique)
- password_hash
- daily_goal_minutes
- education_level
- subjects (array)

**study_sets** - Collections of materials
- id (UUID)
- user_id (FK → users)
- title, description, subject
- created_at, updated_at

**flashcards** - Q&A pairs
- id (UUID)
- study_set_id (FK → study_sets)
- question, answer
- difficulty, times_correct, times_attempted

**quiz_questions** - Multiple choice questions
- id (UUID)
- study_set_id (FK → study_sets)
- question, options[], correct_option_index

**folders** - Organization
- id (UUID)
- user_id (FK → users)
- name, description

**problems** - Problem/solution pairs
- id (UUID)
- user_id (FK → users)
- title, description, solution

**daily_goals** - Daily tracking
- id (UUID)
- user_id (FK → users)
- goal_date, minutes_target, minutes_completed

## API Reference Quick Start

### Authentication
```bash
POST   /api/auth/signup      # Register new user
POST   /api/auth/login       # Authenticate user
GET    /api/auth/me          # Get current user (requires token)
PUT    /api/auth/me          # Update user profile (requires token)
```

### Study Sets
```bash
GET    /api/study-sets       # Get all user's sets (requires token)
POST   /api/study-sets       # Create new set (requires token)
GET    /api/study-sets/:id   # Get single set (requires token)
PUT    /api/study-sets/:id   # Update set (requires token)
DELETE /api/study-sets/:id   # Delete set (requires token)
```

All requests with `(requires token)` need header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Success Checklist

- ✅ PostgreSQL installed and running
- ✅ Backend folder created with all files
- ✅ `.env` configured with database credentials
- ✅ Backend starts without errors
- ✅ Database tables created automatically
- ✅ Can sign up via API (test with cURL/Postman)
- ✅ Can login via API
- ✅ Frontend `.env` points to backend
- ✅ Frontend can sign up through UI
- ✅ Token saved to localStorage
- ✅ User data persists in database
- ✅ Can verify data in PostgreSQL

You're ready to build! 🚀
