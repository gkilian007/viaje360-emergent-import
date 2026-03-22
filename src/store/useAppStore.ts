"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Trip, User, Monument, Achievement, ChatMessage, QuizQuestion, DayItinerary } from "@/lib/types"
import {
  demoUser,
  demoTrip,
  demoMonuments,
  demoAchievements,
  demoChatMessages,
} from "@/lib/demo-data"

interface AppState {
  // Core
  user: User
  currentTrip: Trip | null
  generatedItinerary: DayItinerary[] | null
  monuments: Monument[]
  achievements: Achievement[]

  // Chat
  chatMessages: ChatMessage[]
  isChatLoading: boolean

  // Quiz
  currentQuiz: QuizQuestion | null
  isQuizLoading: boolean
  quizAnswered: boolean
  quizCorrect: boolean | null

  // Achievement overlay
  pendingAchievement: Achievement | null

  // UI
  activeTab: string

  // Actions
  setActiveTab: (tab: string) => void
  addXp: (amount: number) => void
  collectMonument: (monumentId: string) => void
  addChatMessage: (msg: ChatMessage) => void
  setChatLoading: (loading: boolean) => void
  setCurrentQuiz: (quiz: QuizQuestion | null) => void
  setQuizLoading: (loading: boolean) => void
  answerQuiz: (answerIndex: number) => void
  clearQuiz: () => void
  setPendingAchievement: (achievement: Achievement | null) => void
  setCurrentTrip: (trip: Trip | null) => void
  setGeneratedItinerary: (itinerary: DayItinerary[] | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: demoUser,
      currentTrip: demoTrip,
      generatedItinerary: null,
      monuments: demoMonuments,
      achievements: demoAchievements,
      chatMessages: demoChatMessages,
      isChatLoading: false,
      currentQuiz: null,
      isQuizLoading: false,
      quizAnswered: false,
      quizCorrect: null,
      pendingAchievement: null,
      activeTab: "/plan",

      setActiveTab: (tab) => set({ activeTab: tab }),

      addXp: (amount) =>
        set((state) => {
          const newXp = state.user.xp + amount
          const newLevel = Math.floor(newXp / 500) + 1
          return {
            user: {
              ...state.user,
              xp: newXp,
              level: Math.max(state.user.level, Math.min(newLevel, 20)),
            },
          }
        }),

      collectMonument: (monumentId) =>
        set((state) => {
          const monument = state.monuments.find((m) => m.id === monumentId)
          if (!monument || monument.collected) return state
          return {
            monuments: state.monuments.map((m) =>
              m.id === monumentId
                ? { ...m, collected: true, collectedAt: new Date().toISOString() }
                : m
            ),
            user: {
              ...state.user,
              xp: state.user.xp + monument.xpReward,
              monumentsCollected: state.user.monumentsCollected + 1,
            },
          }
        }),

      addChatMessage: (msg) =>
        set((state) => ({ chatMessages: [...state.chatMessages, msg] })),

      setChatLoading: (loading) => set({ isChatLoading: loading }),

      setCurrentQuiz: (quiz) => set({ currentQuiz: quiz, quizAnswered: false, quizCorrect: null }),

      setQuizLoading: (loading) => set({ isQuizLoading: loading }),

      answerQuiz: (answerIndex) =>
        set((state) => {
          if (!state.currentQuiz) return state
          const correct = answerIndex === state.currentQuiz.correctIndex
          return {
            quizAnswered: true,
            quizCorrect: correct,
            user: correct
              ? {
                  ...state.user,
                  xp: state.user.xp + (state.currentQuiz?.xpReward ?? 50),
                }
              : state.user,
          }
        }),

      clearQuiz: () =>
        set({ currentQuiz: null, quizAnswered: false, quizCorrect: null }),

      setPendingAchievement: (achievement) => set({ pendingAchievement: achievement }),

      setCurrentTrip: (trip) => set({ currentTrip: trip }),

      setGeneratedItinerary: (itinerary) => set({ generatedItinerary: itinerary }),
    }),
    {
      name: "viaje360-app-store",
      partialize: (state) => ({
        user: state.user,
        currentTrip: state.currentTrip,
        generatedItinerary: state.generatedItinerary,
        monuments: state.monuments,
        achievements: state.achievements,
        chatMessages: state.chatMessages,
        activeTab: state.activeTab,
      }),
    }
  )
)
