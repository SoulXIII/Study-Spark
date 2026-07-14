# Quick Start Checklist

## 🚀 Get Up and Running in 10 Minutes

### Step 1: Set Up Database (2 min)
```bash
# Windows: Just need PostgreSQL installed
psql -U postgres -c "CREATE DATABASE studyspark;"

# Mac
brew install postgresql@15
createdb studyspark

# Linux
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres createdb studyspark
```

### Step 2: Start Backend (3 min)
```bash
cd backend
npm install
cp .env.example .env

# Edit .env with your db password
# DB_PASSWORD=YOUR_POSTGRES_PASSWORD

npm run dev
```

**Expected:** "✅ Server running on http://localhost:5000"

### Step 3: Test Backend (1 min)
```bash
curl http://localhost:5000/health
# Should return: {"status":"Backend is running"}
```

### Step 4: Connect Frontend (2 min)
```bash
cd academic-alchemy-ai-main

# If .env doesn't exist:
echo "VITE_API_URL=http://localhost:5000/api" > .env

# Verify it's set:
grep VITE_API_URL .env
```

### Step 5: Start Frontend (2 min)
```bash
npm run dev
```

**You're done!** 🎉

Open http://localhost:8080 and test sign up

---

## 📋 To Test Sign Up

1. Go to http://localhost:8080/signup
2. Enter any email/password
3. Details saved to PostgreSQL ✅
4. Token saved to browser localStorage ✅
5. Redirects to /onboarding ✅

## 🐛 Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED :5432` | Start PostgreSQL |
| Port 5000 in use | Change PORT in `.env` |
| CORS errors | Restart backend after editing `.env` |
| "database does not exist" | Run `createdb studyspark` |

## 📂 New Files Created

**Backend Folder:**
```
backend/
├── src/
│   ├── config/database.js       - PostgreSQL connection pool
│   ├── middleware/auth.js       - JWT token handling
│   ├── models/database.js       - Initialize tables
│   ├── routes/
│   │   ├── auth.js              - Sign up, login, user profile
│   │   └── studySets.js         - CRUD operations
│   └── index.js                 - Express server
├── .env                         - Configuration (create from .env.example)
├── .env.example                 - Template
├── package.json                 - Dependencies
├── README.md                    - Full documentation
└── FRONTEND_CONNECTION.md       - How to connect frontend
```

**Documentation:**
```
COMPLETE_SETUP_GUIDE.md         - Full step-by-step guide
QUICK_START_CHECKLIST.md        - This file
```

## 🔌 API Quick Reference

### Sign Up
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","password":"pass123"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"pass123"}'
```

### Get Current User (with token)
```bash
curl -H "Authorization: Bearer TOKEN_HERE" \
  http://localhost:5000/api/auth/me
```

## ✅ Your Next Tasks

1. **Add more API routes:**
   - `backend/src/routes/flashcards.js`
   - `backend/src/routes/quizzes.js`
   - `backend/src/routes/folders.js`

2. **Update frontend hooks:**
   - Replace mock data with API calls
   - Use useQuery for GET, useMutation for POST/PUT/DELETE

3. **Test all flows:**
   - Sign up → verify in database
   - Login → verify token in localStorage
   - Create study set → verify in database

---

## 📖 Full Documentation

For complete details, see:
- `COMPLETE_SETUP_GUIDE.md` - Everything explained step-by-step
- `backend/README.md` - Backend API documentation
- `backend/FRONTEND_CONNECTION.md` - Integration instructions

---

**Any issues?** Check the Troubleshooting section in `COMPLETE_SETUP_GUIDE.md` 🔍
