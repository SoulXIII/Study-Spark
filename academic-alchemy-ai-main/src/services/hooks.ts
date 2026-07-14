import { useQuery, useMutation, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import { apiClient } from "./api";
import {
  User,
  StudySet,
  Folder,
  Flashcard,
  QuizQuestion,
  Problem,
  DailyGoal,
} from "./types";

/**
 * ========== USER QUERIES ==========
 */

export const useCurrentUser = (): UseQueryResult<User> => {
  return useQuery({
    queryKey: ["user", "current"],
    queryFn: () => apiClient.get<User>("/users/me"),
  });
};

/**
 * ========== STUDY SET QUERIES ==========
 */

export const useStudySets = (userId?: string): UseQueryResult<StudySet[]> => {
  return useQuery({
    queryKey: ["study-sets", userId],
    queryFn: () =>
      apiClient.get<StudySet[]>("/study-sets", userId ? { userId } : undefined),
  });
};

export const useStudySet = (id: string): UseQueryResult<StudySet> => {
  return useQuery({
    queryKey: ["study-sets", id],
    queryFn: () => apiClient.get<StudySet>(`/study-sets/${id}`),
    enabled: !!id,
  });
};

export const useCreateStudySet = (): UseMutationResult<
  StudySet,
  Error,
  Omit<StudySet, "id">
> => {
  return useMutation({
    mutationFn: (data) => apiClient.post<StudySet>("/study-sets", data),
  });
};

export const useUpdateStudySet = (): UseMutationResult<
  StudySet,
  Error,
  { id: string; data: Partial<StudySet> }
> => {
  return useMutation({
    mutationFn: ({ id, data }) =>
      apiClient.put<StudySet>(`/study-sets/${id}`, data),
  });
};

export const useDeleteStudySet = (): UseMutationResult<void, Error, string> => {
  return useMutation({
    mutationFn: (id) => apiClient.delete<void>(`/study-sets/${id}`),
  });
};

/**
 * ========== FOLDER QUERIES ==========
 */

export const useFolders = (userId?: string): UseQueryResult<Folder[]> => {
  return useQuery({
    queryKey: ["folders", userId],
    queryFn: () =>
      apiClient.get<Folder[]>("/folders", userId ? { userId } : undefined),
  });
};

export const useFolder = (id: string): UseQueryResult<Folder> => {
  return useQuery({
    queryKey: ["folders", id],
    queryFn: () => apiClient.get<Folder>(`/folders/${id}`),
    enabled: !!id,
  });
};

/**
 * ========== FLASHCARD QUERIES ==========
 */

export const useFlashcards = (setId: string): UseQueryResult<Flashcard[]> => {
  return useQuery({
    queryKey: ["flashcards", setId],
    queryFn: () => apiClient.get<Flashcard[]>(`/flashcards`, { setId }),
    enabled: !!setId,
  });
};

export const useCreateFlashcard = (): UseMutationResult<
  Flashcard,
  Error,
  Omit<Flashcard, "id">
> => {
  return useMutation({
    mutationFn: (data) => apiClient.post<Flashcard>("/flashcards", data),
  });
};

export const useUpdateFlashcard = (): UseMutationResult<
  Flashcard,
  Error,
  { id: string; data: Partial<Flashcard> }
> => {
  return useMutation({
    mutationFn: ({ id, data }) =>
      apiClient.put<Flashcard>(`/flashcards/${id}`, data),
  });
};

export const useDeleteFlashcard = (): UseMutationResult<void, Error, string> => {
  return useMutation({
    mutationFn: (id) => apiClient.delete<void>(`/flashcards/${id}`),
  });
};

/**
 * ========== QUIZ QUERIES ==========
 */

export const useQuizQuestions = (
  setId: string
): UseQueryResult<QuizQuestion[]> => {
  return useQuery({
    queryKey: ["quiz-questions", setId],
    queryFn: () =>
      apiClient.get<QuizQuestion[]>(`/quiz-questions`, { setId }),
    enabled: !!setId,
  });
};

export const useCreateQuizQuestion = (): UseMutationResult<
  QuizQuestion,
  Error,
  Omit<QuizQuestion, "id">
> => {
  return useMutation({
    mutationFn: (data) => apiClient.post<QuizQuestion>("/quiz-questions", data),
  });
};

/**
 * ========== PROBLEM QUERIES ==========
 */

export const useProblems = (setId: string): UseQueryResult<Problem[]> => {
  return useQuery({
    queryKey: ["problems", setId],
    queryFn: () => apiClient.get<Problem[]>(`/problems`, { setId }),
    enabled: !!setId,
  });
};

export const useProblem = (id: string): UseQueryResult<Problem> => {
  return useQuery({
    queryKey: ["problems", id],
    queryFn: () => apiClient.get<Problem>(`/problems/${id}`),
    enabled: !!id,
  });
};

/**
 * ========== DAILY GOAL QUERIES ==========
 */

export const useDailyGoal = (userId: string): UseQueryResult<DailyGoal> => {
  return useQuery({
    queryKey: ["daily-goal", userId],
    queryFn: () => apiClient.get<DailyGoal>(`/daily-goals/${userId}`),
    enabled: !!userId,
  });
};

export const useUpdateDailyGoal = (): UseMutationResult<
  DailyGoal,
  Error,
  { userId: string; data: Partial<DailyGoal> }
> => {
  return useMutation({
    mutationFn: ({ userId, data }) =>
      apiClient.put<DailyGoal>(`/daily-goals/${userId}`, data),
  });
};
