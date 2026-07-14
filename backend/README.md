# StudySpark Backend Setup Guide

## Prerequisites

1. **Node.js** (v16+) - [Download here](https://nodejs.org/)
2. **PostgreSQL** (v12+) - [Download here](https://www.postgresql.org/download/)
3. **npm** or **bun** - Usually comes with Node.js

## Installation Steps

### 1. Install Dependencies

```bash
cd backend
npm install
# or
bun install
```

### 2. Set Up PostgreSQL

#### On Windows:
1. **Install PostgreSQL** from https://www.postgresql.org/download/windows/
2. **psql** should be available in your PATH
3. **Create a database:**

```bash
psql -U postgres -c "CREATE DATABASE studyspark;"
```

#### On macOS:
```bash
brew install postgresql@15
brew services start postgresql@15
createdb studyspark
```

#### On Linux (Ubuntu/Debian):
```bash
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres createdb studyspark
```

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` with your database credentials:
```env
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=studyspark
JWT_SECRET=your-super-secret-key-change-this
```

### 4. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

You should see:
```
✅ Server running on http://localhost:5000
📡 API available at http://localhost:5000/api
```

## API Endpoints

### Authentication (`/api/auth`)

#### Sign Up
```bash
POST /api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "educationLevel": null,
    "subjects": [],
    "dailyGoalMinutes": 30
  },
  "token": "jwt_token_here"
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Current User
```bash
GET /api/auth/me
Authorization: Bearer {token}
```

#### Update User
```bash
PUT /api/auth/me
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Jane Doe",
  "educationLevel": "university",
  "subjects": ["Math", "Physics"],
  "dailyGoalMinutes": 60
}
```

### Study Sets (`/api/study-sets`)

#### Get All Study Sets
```bash
GET /api/study-sets
Authorization: Bearer {token}
```

#### Create Study Set
```bash
POST /api/study-sets
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Biology 101",
  "description": "Basic biology concepts",
  "subject": "Biology"
}
```

#### Get Single Study Set
```bash
GET /api/study-sets/{id}
Authorization: Bearer {token}
```

#### Update Study Set
```bash
PUT /api/study-sets/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Biology 102",
  "description": "Advanced biology"
}
```

#### Delete Study Set
```bash
DELETE /api/study-sets/{id}
Authorization: Bearer {token}
```

## Testing with cURL

### Sign Up Example
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Get Current User Example
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Next Steps

1. **Connect Frontend** - Update `src/services/api.ts` to point to `http://localhost:5000`
2. **Add More Routes** - Create routes for flashcards, quiz questions, folders
3. **Implement Validation** - Add input validation middleware
4. **Add Testing** - Set up Jest for API testing
5. **Deploy** - Set up production database and deploy to hosting

## Troubleshooting

### "Database connection failed"
- Ensure PostgreSQL is running
- Check `.env` credentials
- Try: `psql -U postgres -d studyspark -c "SELECT 1"`

### "Port 5000 already in use"
- Change `PORT` in `.env`
- Or kill existing process: `lsof -ti:5000 | xargs kill -9`

### "JWT_SECRET is missing"
- Add `JWT_SECRET` to `.env`
- Generate a secure key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Database Schema

The backend creates these tables automatically:
- `users` - User accounts
- `study_sets` - Study collections
- `flashcards` - Flashcard questions
- `quiz_questions` - Quiz questions
- `folders` - Folder organization
- `problems` - Problem/solution items
- `daily_goals` - Daily study goals

All tables include proper indexes and relationships for optimal performance.
