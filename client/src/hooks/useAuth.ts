'use client'

// --- useAuth hook -------------------------------------------------------------
import { useCallback } from 'react'
import { useRouter }   from 'next/navigation'
import apiClient       from '@/lib/apiClient'
import { setToken, clearToken, isAuthenticated } from '@/lib/auth'
import { useAppStore } from '@/store'

export function useAuth() {
  const { currentUser, isAuthenticated: storeAuthenticated, setCurrentUser, loginSuccess, logout: storeLogout } = useAppStore()
  const router = useRouter()

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.login(email, password)
    setToken(res.token)
    loginSuccess(res.user)
    router.push('/dashboard')
  }, [loginSuccess, router])

  const logout = useCallback(() => {
    clearToken()
    storeLogout()
    router.push('/login')
  }, [storeLogout, router])

  return {
    currentUser,
    isAuthenticated: storeAuthenticated || isAuthenticated(),
    login,
    logout,
    setCurrentUser,
  }
}
