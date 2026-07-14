# Frontend to Backend Connection Guide

## Step 1: Update Frontend Environment Variables

In `academic-alchemy-ai-main/.env`, update:

```env
VITE_API_URL=http://localhost:5000/api
```

## Step 2: Update API Service

The frontend already has `src/services/api.ts` configured. Update it to use auth tokens properly:

```typescript
// src/services/api.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = {
  get: async (endpoint: string) => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return fetch(`${API_URL}${endpoint}`, { headers }).then(r => r.json());
  },

  post: async (endpoint: string, data: any) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
    return fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    }).then(r => r.json());
  },

  put: async (endpoint: string, data: any) => {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
    return fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    }).then(r => r.json());
  },

  delete: async (endpoint: string) => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return fetch(`${API_URL}${endpoint}`, { method: 'DELETE', headers }).then(r => r.json());
  },
};
```

## Step 3: Update AuthContext to Save Token

In `src/context/AuthContext.tsx`, modify the login/signup methods to save the token:

```typescript
const login = async (email: string, password: string, name?: string) => {
  const response = await api.post('/auth/login', { email, password });
  
  if (response.user) {
    setUser(response.user);
    setIsLoggedIn(true);
    // Save both user and token
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('token', response.token);  // ← Add this
  }
};

const logout = () => {
  setUser(null);
  setIsLoggedIn(false);
  localStorage.removeItem('user');
  localStorage.removeItem('token');  // ← Add this
};
```

## Step 4: Update Page Components to Use Backend

### Example: Index.tsx (Home Page)

Replace mock study sets with API calls:

```typescript
import { useStudySets, useCurrentUser } from '@/services/hooks';

const Index = () => {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: studySets, isLoading: setsLoading } = useStudySets();
  const { greeting, emoji } = useGreeting();

  if (userLoading || setsLoading) {
    return <div>Loading...</div>;
  }

  return (
    // ... rest of component using user and studySets data
  );
};
```

## Step 5: Test the Connection

1. **Start Backend:**
```bash
cd backend
npm run dev
```

2. **Start Frontend (in another terminal):**
```bash
cd academic-alchemy-ai-main
npm run dev
```

3. **Test Sign Up:**
   - Go to `http://localhost:8080/signup`
   - Fill in form and submit
   - Check browser console (F12) for token in localStorage
   - Check backend logs for database entry

4. **Test Login:**
   - Log out and go to `http://localhost:8080/login`
   - Use same credentials from signup
   - Should redirect to home

5. **Test API Calls:**
   - After logging in, go to home
   - Should fetch user data from `/api/auth/me`
   - Create study set should POST to `/api/study-sets`

## Step 6: Verify Database Connection

Check if data is being saved:

```bash
psql -U postgres -d studyspark

# In psql:
SELECT * FROM users;
SELECT * FROM study_sets;
```

## Common Issues & Fixes

### Issue: "Failed to fetch" / CORS error
- Ensure backend is running on port 5000
- Check `FRONTEND_URL` in backend `.env` matches frontend URL
- Restart backend after changing `.env`

### Issue: "Invalid or expired token"
- Clear localStorage: `localStorage.clear()` in console
- Log out and log back in
- Check JWT_SECRET in backend `.env`

### Issue: Database errors
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Run: `psql -U postgres -d studyspark -c "SELECT 1"`

### Issue: "Cannot find module"
- Run `npm install` in backend folder
- Ensure all dependencies from `package.json` are installed

## Next: Create More API Routes

The backend is ready for more routes. Create files for:
- `src/routes/flashcards.js` - Flashcard operations
- `src/routes/quizzes.js` - Quiz questions
- `src/routes/folders.js` - Folder management
- `src/routes/problems.js` - Problem/solutions

Each should follow the same pattern as `studySets.js`

## Update Frontend Hooks

After creating backend routes, update `src/services/hooks.ts` with real API calls:

```typescript
export const useStudySets = () => {
  return useQuery({
    queryKey: ['studySets'],
    queryFn: () => api.get('/study-sets'),
  });
};

export const useCreateStudySet = () => {
  return useMutation({
    mutationFn: (data) => api.post('/study-sets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studySets'] });
    },
  });
};
```

That's it! You now have a fully connected frontend-backend system with database persistence.
