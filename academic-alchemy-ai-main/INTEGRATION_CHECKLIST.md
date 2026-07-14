# Database Integration Checklist

## Pre-Integration Setup ✅
- [x] Created `src/services/` directory
- [x] Created `src/services/api.ts` - API client
- [x] Created `src/services/types.ts` - TypeScript interfaces
- [x] Created `src/services/hooks.ts` - React Query hooks
- [x] Created `.env` - Environment configuration
- [x] Created documentation files

## Your Backend Setup 📝
- [ ] Backend API running on configured port (default: 5000)
- [ ] CORS enabled for http://localhost:8080
- [ ] Database connected and ready

## Backend Endpoints Implementation ✅
Implement these endpoints in your backend:

### User Endpoints
- [ ] `GET /api/users/me` - Get current user profile
  - Required fields: id, name, email, streak, totalMinutesStudied
  - Optional fields: avatar

### Study Set Endpoints
- [ ] `GET /api/study-sets` - List all study sets (with optional userId filter)
- [ ] `GET /api/study-sets/:id` - Get specific study set
- [ ] `POST /api/study-sets` - Create new study set
- [ ] `PUT /api/study-sets/:id` - Update study set
- [ ] `DELETE /api/study-sets/:id` - Delete study set

### Folder Endpoints
- [ ] `GET /api/folders` - List all folders (with optional userId filter)
- [ ] `GET /api/folders/:id` - Get specific folder

### Flashcard Endpoints
- [ ] `GET /api/flashcards?setId=:setId` - List flashcards by study set
- [ ] `POST /api/flashcards` - Create new flashcard
- [ ] `PUT /api/flashcards/:id` - Update flashcard
- [ ] `DELETE /api/flashcards/:id` - Delete flashcard

### Quiz Question Endpoints
- [ ] `GET /api/quiz-questions?setId=:setId` - List quiz questions by study set
- [ ] `POST /api/quiz-questions` - Create new quiz question

### Problem Endpoints
- [ ] `GET /api/problems?setId=:setId` - List problems by study set
- [ ] `GET /api/problems/:id` - Get specific problem

### Daily Goal Endpoints
- [ ] `GET /api/daily-goals/:userId` - Get daily goal progress
- [ ] `PUT /api/daily-goals/:userId` - Update daily goal progress

## Frontend Migration 🔄
Replace mock data in these pages with API hooks:

### Index.tsx (Dashboard)
- [ ] Replace `mockSets` with `useStudySets()` hook
- [ ] Replace `mockFolders` with `useFolders()` hook
- [ ] Replace hardcoded greeting ("Alex") with `useCurrentUser()` hook
- [ ] Replace hardcoded streak (7) with `useCurrentUser()` hook data
- [ ] Replace hardcoded daily progress (65%, 20/30) with `useDailyGoal()` hook
- [ ] Add loading states for better UX
- [ ] Add error handling

### FlashcardMode.tsx
- [ ] Replace `mockCards` with `useFlashcards(setId)` hook
- [ ] Get setId from URL params
- [ ] Add loading state while cards are fetching
- [ ] Handle empty state (no cards)

### QuizMode.tsx
- [ ] Replace `mockQuestions` with `useQuizQuestions(setId)` hook
- [ ] Get setId from URL params
- [ ] Add loading state while questions are fetching
- [ ] Handle empty state (no questions)

### FoldersPage.tsx
- [ ] Replace `mockFolders` with `useFolders()` hook
- [ ] Add loading state

### SolvePage.tsx
- [ ] Replace `mockSolution` with `useProblems()` or `useProblem(id)` hook
- [ ] Update to fetch actual problem data

## Testing & Validation ✅
- [ ] Backend API is running
- [ ] Frontend `npm run dev` is running
- [ ] Open http://localhost:8080 in browser
- [ ] Open DevTools → Network tab
- [ ] Check that API calls are being made to your backend
- [ ] Verify the response data matches TypeScript types
- [ ] Check for CORS errors (if any, fix in backend)
- [ ] Load each page and verify data displays correctly
- [ ] Test loading states appear during data fetch

## Debugging Commands
Run these in terminal to help debug:

```bash
# Check if backend is running
curl http://localhost:5000/api/users/me

# Check frontend dev server is running
curl http://localhost:8080

# View API environment config
grep VITE_API_URL .env

# Check if node_modules installed
ls node_modules | head -10
```

## Common Issues & Solutions

### "API Error: 404"
- [ ] Backend endpoint URL doesn't match
- [ ] Check `VITE_API_URL` in `.env`
- [ ] Verify backend is running

### "CORS Error"
- [ ] Backend CORS is not configured
- [ ] Add CORS middleware to backend
- [ ] Allow origin: http://localhost:8080

### "TypeError: Cannot read property ... of undefined"
- [ ] API returned different data structure than expected
- [ ] Check backend response matches TypeScript types
- [ ] Verify type definitions in `src/services/types.ts`

### "React Query showing stale data"
- [ ] Check `queryKey` matches the endpoint
- [ ] Use `refetchOnMount` or `invalidateQueries` to refresh
- [ ] See React Query docs: https://tanstack.com/query

## Documentation References
- `DATABASE_INTEGRATION_GUIDE.md` - Complete guide with code examples
- `BACKEND_API_TEMPLATE.md` - Reference for API endpoints
- `MIGRATION_SUMMARY.md` - Overview of all changes

## Completion Status
- [x] Infrastructure setup (100%)
- [ ] Backend implementation (0% - your responsibility)
- [ ] Frontend migration (0% - your responsibility)
- [ ] Testing & validation (0%)

---

**Questions?** Refer to the documentation files or check the comments in `src/services/hooks.ts`
