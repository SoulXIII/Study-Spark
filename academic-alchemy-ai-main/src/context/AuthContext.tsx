import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  educationLevel?: string;
  subjects?: string[];
  dailyGoalMinutes?: number;
  isPro?: boolean;
  proSince?: string | null;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (email: string, password: string, name?: string, isSignUp?: boolean) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        setIsLoggedIn(true);
        // Refresh from API to get latest flags (isAdmin, isPro, etc.)
        fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${storedToken}` } })
          .then(r => {
            if (r.status === 401) {
              // Token expired — clear session so user is redirected to login
              localStorage.removeItem("user");
              localStorage.removeItem("token");
              setUser(null);
              setToken(null);
              setIsLoggedIn(false);
              return null;
            }
            return r.ok ? r.json() : null;
          })
          .then(data => {
            if (data) {
              const updated = {
                ...parsedUser,
                isAdmin: data.isAdmin ?? parsedUser.isAdmin,
                isPro: data.isPro ?? parsedUser.isPro,
                proSince: data.proSince ?? parsedUser.proSince,
              };
              setUser(updated);
              localStorage.setItem("user", JSON.stringify(updated));
            }
          })
          .catch(() => {});
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
  }, []);

  const login = async (email: string, password: string, name?: string, isSignUp: boolean = false) => {   



                            
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    if (isSignUp && !name) {
      throw new Error("Name is required for signup");
    }

    try {
      const endpoint = isSignUp ? "/auth/signup" : "/auth/login";
      const payload = isSignUp 
        ? { email, password, name }
        : { email, password };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Authentication failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract user and token from response
      const newUser: User = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        educationLevel: data.user.educationLevel || "",
        subjects: data.user.subjects || [],
        dailyGoalMinutes: data.user.dailyGoalMinutes || 30,
        isPro: data.user.isPro || false,
        proSince: data.user.proSince || null,
        isAdmin: data.user.isAdmin || false,
      };

      const newToken = data.token;

      setUser(newUser);
      setToken(newToken);
      setIsLoggedIn(true);
      
      // Store in localStorage
      localStorage.setItem("user", JSON.stringify(newUser));
      localStorage.setItem("token", newToken);
    } catch (error) {
      console.error("Authentication error:", error);
      throw error instanceof Error ? error : new Error("Authentication failed");
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsLoggedIn(false);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, login, logout, updateUser, token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
