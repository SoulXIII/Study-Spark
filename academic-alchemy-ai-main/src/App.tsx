import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Onboarding from "./pages/Onboarding";
import CreateStudySet from "./pages/CreateStudySet";
import StudySetDetail from "./pages/StudySetDetail";
import FlashcardMode from "./pages/FlashcardMode";
import QuizMode from "./pages/QuizMode";
import FoldersPage from "./pages/FoldersPage";
import FolderDetailPage from "./pages/FolderDetailPage";
import ProfilePage from "./pages/ProfilePage";
import SolvePage from "./pages/SolvePage";
import AdminDashboard from "./pages/AdminDashboard";
import PokedexPage from "./pages/PokedexPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

// Admin-only route — must be logged in AND isAdmin
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, user } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/" replace />;
  return children;
};

const AppRoutes = () => {
  const { isLoggedIn } = useAuth();

  return (
    <AnimatePresence mode="wait">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={isLoggedIn ? <Navigate to="/" replace /> : <SignUp />} />
        <Route path="/onboarding" element={isLoggedIn ? <Onboarding /> : <Navigate to="/login" replace />} />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Index />} />
          <Route path="/create" element={<CreateStudySet />} />
          <Route path="/study-set/:id" element={<StudySetDetail />} />
          <Route path="/study-set/:id/flashcards" element={<FlashcardMode />} />
          <Route path="/study-set/:id/quiz" element={<QuizMode />} />
          <Route path="/solve" element={<SolvePage />} />
          <Route path="/folders" element={<FoldersPage />} />
          <Route path="/folders/:id" element={<FolderDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/pokedex" element={<PokedexPage />} />
        </Route>

        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  useEffect(() => {
    // Initialize dark mode from localStorage on app load
    const savedDarkMode = localStorage.getItem("darkMode");
    const isDarkMode = savedDarkMode === null ? true : JSON.parse(savedDarkMode); // Default to true
    
    if (isDarkMode) {
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
