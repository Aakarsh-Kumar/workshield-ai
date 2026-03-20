'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/lib/apiClient';

interface AppState {
  currentUser: User | null;
  isAuthenticated: boolean;

  setCurrentUser: (user: User) => void;
  loginSuccess: (user: User) => void;
  logout: () => void;
}

/**
 * Global app store backed by Zustand with localStorage persistence.
 * Auth state and the current user are persisted across page reloads.
 *
 * Usage:
 *   const { currentUser, loginSuccess, logout } = useAppStore();
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,

      setCurrentUser: (user) => set({ currentUser: user }),

      loginSuccess: (user) => set({ currentUser: user, isAuthenticated: true }),

      logout: () => set({ currentUser: null, isAuthenticated: false }),
    }),
    {
      name: 'workshield-store',
      // Only persist auth-related fields — exclude derived/transient state
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
