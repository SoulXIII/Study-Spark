// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  streak: number;
  totalMinutesStudied: number;
}

// Study Set Types
export interface StudySet {
  id: string;
  title: string;
  subject: string;
  description?: string;
  progress: number;
  lastStudied: string;
  color: string;
  cardCount: number;
  folderId: string;
}

// Folder Types
export interface Folder {
  id: string;
  name: string;
  sets: number;
  progress: number;
  icon: string;
  color: string;
}

// Flashcard Types
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  setId: string;
}

// Quiz Question Types
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  setId: string;
}

// Problem Solution Types
export interface ProblemStep {
  step: string;
  result: string;
}

export interface Problem {
  id: string;
  problem: string;
  steps: ProblemStep[];
  answer: string;
  setId: string;
}

// Daily Goal Types
export interface DailyGoal {
  userId: string;
  minutesTarget: number;
  minutesCompleted: number;
  percentComplete: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
