# Database Integration Guide

## Overview
The project has been set up to replace mock data with actual database connections. All API calls should go through the new service layer located in `src/services/`.

## File Structure
```
src/services/
├── api.ts          # Main API client for all HTTP requests
├── hooks.ts        # React Query hooks for data fetching
└── types.ts        # TypeScript interfaces for all data models
```

## Configuration

### Environment Setup
1. Copy `.env.example` to create your own `.env` file (already done)
2. Update `VITE_API_URL` with your local database API endpoint:
   ```
   VITE_API_URL=http://localhost:5000/api
   ```

## How to Use the API Service

### For Fetching Data
Use the provided React Query hooks in `src/services/hooks.ts`:

```typescript
import { useStudySets } from "@/services/hooks";

function MyComponent() {
  const { data: studySets, isLoading, error } = useStudySets();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {studySets?.map(set => (
        <div key={set.id}>{set.title}</div>
      ))}
    </div>
  );
}
```

### For Creating/Updating Data
Use mutation hooks:

```typescript
import { useCreateStudySet } from "@/services/hooks";

function CreateSetForm() {
  const mutation = useCreateStudySet();
  
  const handleSubmit = (data) => {
    mutation.mutate(data, {
      onSuccess: () => {
        console.log("Study set created!");
      },
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

## Available Hooks

### User
- `useCurrentUser()` - Get current logged-in user

### Study Sets
- `useStudySets(userId?)` - Get all study sets
- `useStudySet(id)` - Get single study set
- `useCreateStudySet()` - Create new study set
- `useUpdateStudySet()` - Update study set
- `useDeleteStudySet()` - Delete study set

### Folders
- `useFolders(userId?)` - Get all folders
- `useFolder(id)` - Get single folder

### Flashcards
- `useFlashcards(setId)` - Get flashcards for a study set
- `useCreateFlashcard()` - Create new flashcard
- `useUpdateFlashcard()` - Update flashcard
- `useDeleteFlashcard()` - Delete flashcard

### Quiz Questions
- `useQuizQuestions(setId)` - Get quiz questions for a study set
- `useCreateQuizQuestion()` - Create new quiz question

### Problems
- `useProblems(setId)` - Get problems for a study set
- `useProblem(id)` - Get single problem

### Daily Goals
- `useDailyGoal(userId)` - Get daily goal progress
- `useUpdateDailyGoal()` - Update daily goal progress

## Migration Examples

### Example 1: Index.tsx - Replace Mock Study Sets

**Before (Mock Data):**
```typescript
const mockSets = [
  { id: "1", title: "Cell Biology", subject: "Science", progress: 72, ...},
  { id: "2", title: "French Revolution", subject: "History", progress: 45, ...},
];

export default function Index() {
  return <div>{mockSets.map(set => ...)}</div>;
}
```

**After (Database):**
```typescript
import { useStudySets, useCurrentUser, useDailyGoal } from "@/services/hooks";

export default function Index() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: studySets, isLoading: setsLoading } = useStudySets(user?.id);
  const { data: dailyGoal } = useDailyGoal(user?.id || "");
  
  if (userLoading || setsLoading) return <div>Loading...</div>;
  if (!user || !studySets) return <div>No data available</div>;
  
  return (
    <div>
      <h1>Good morning, {user.name}! 👋</h1>
      <div>{user.streak}</div>
      <div>{dailyGoal?.percentComplete}%</div>
      {studySets.map(set => (...))}
    </div>
  );
}
```

### Example 2: FlashcardMode.tsx - Replace Mock Cards

**Before (Mock Data):**
```typescript
const mockCards = [
  { front: "What is...", back: "The answer is..." },
];

export default function FlashcardMode() {
  const { id } = useParams();
  // uses mockCards instead
}
```

**After (Database):**
```typescript
import { useFlashcards } from "@/services/hooks";

export default function FlashcardMode() {
  const { id } = useParams();
  const { data: cards = [], isLoading } = useFlashcards(id || "");
  
  if (isLoading) return <div>Loading cards...</div>;
  if (cards.length === 0) return <div>No cards in this set</div>;
  
  const card = cards[index];
  // use card.front and card.back
}
```

### Example 3: QuizMode.tsx - Replace Mock Questions

**Before (Mock Data):**
```typescript
const mockQuestions = [
  { question: "...", options: [...], correct: 1, ... },
];
```

**After (Database):**
```typescript
import { useQuizQuestions } from "@/services/hooks";

export default function QuizMode() {
  const { id } = useParams();
  const { data: questions = [], isLoading } = useQuizQuestions(id || "");
  
  if (isLoading) return <div>Loading quiz...</div>;
  if (questions.length === 0) return <div>No questions available</div>;
  
  const q = questions[index];
}
```

## Next Steps

1. **Set up Backend API**: Create your local database API (Node/Express, Python/Django, etc.)
   - Should expose endpoints matching the API structure in `api.ts`
   - Use TypeScript interfaces from `types.ts` as reference

2. **Replace Mock Data**: Update each page to use the new hooks instead of mock data
   - Start with: `Index.tsx`, `FoldersPage.tsx`, `FlashcardMode.tsx`, `QuizMode.tsx`, `SolvePage.tsx`

3. **Handle Loading/Error States**: Use the `isLoading` and `error` states from hooks for better UX

4. **Cache Management**: React Query automatically caches data and handles refetching. Use `onSuccess` callbacks for mutations to sync UI

## API Endpoint Examples

Your backend should implement these endpoints (adjust paths as needed):

```
GET    /api/users/me
GET    /api/study-sets
GET    /api/study-sets/:id
POST   /api/study-sets
PUT    /api/study-sets/:id
DELETE /api/study-sets/:id

GET    /api/folders
GET    /api/folders/:id

GET    /api/flashcards?setId=:setId
POST   /api/flashcards
PUT    /api/flashcards/:id
DELETE /api/flashcards/:id

GET    /api/quiz-questions?setId=:setId
POST   /api/quiz-questions

GET    /api/problems?setId=:setId
GET    /api/problems/:id

GET    /api/daily-goals/:userId
PUT    /api/daily-goals/:userId
```

## Debugging

To check if your API is connected:
1. Open browser DevTools Network tab
2. Execute a query hook action
3. Watch for API calls to your backend
4. Check the response in the Network tab

If you see CORS errors, configure CORS on your backend:
```javascript
// Example for Node/Express
app.use(cors({
  origin: "http://localhost:8080",
  credentials: true
}));
```

## TypeScript Support

All data types are exported from `src/services/types.ts`. Import them when needed:

```typescript
import { StudySet, Folder, Flashcard, QuizQuestion } from "@/services/types";
```

This ensures type safety across your application!
