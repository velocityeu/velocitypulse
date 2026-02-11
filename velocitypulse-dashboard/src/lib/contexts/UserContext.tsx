'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'

interface UserData {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  image_url: string | null
  is_staff: boolean
  created_at: string
}

interface UserContextValue {
  user: UserData | null
  isLoading: boolean
  isSignedIn: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

// Module-level cache — survives component remounts so navigations never flicker
let cachedUser: UserData | null = null

/** Clear the module-level user cache. Called by authFetch on 401. */
export function clearUserCache(): void {
  cachedUser = null
}

interface UserProviderProps {
  children: ReactNode
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<UserData | null>(cachedUser)
  const [isLoading, setIsLoading] = useState(cachedUser === null)
  const [error, setError] = useState<Error | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchUser = useCallback(async () => {
    // Skip if we already have cached data
    if (cachedUser) return

    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setError(null)
      setIsLoading(true)

      const response = await fetch('/api/user/me', { signal: controller.signal })

      if (!response.ok) {
        if (response.status === 401) {
          // Not signed in — not an error, just no user
          setUser(null)
          return
        }
        throw new Error('Failed to fetch user')
      }

      const data = await response.json()
      cachedUser = data.user
      setUser(data.user)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Failed to fetch user:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch user'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Explicit refetch — clears the module cache and re-fetches
  const refetch = useCallback(async () => {
    cachedUser = null
    setUser(null)
    await fetchUser()
  }, [fetchUser])

  useEffect(() => {
    fetchUser()
    return () => { abortControllerRef.current?.abort() }
  }, [fetchUser])

  const value: UserContextValue = {
    user,
    isLoading,
    isSignedIn: user !== null,
    error,
    refetch,
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser(): UserContextValue {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useCurrentUser must be used within a UserProvider')
  }
  return context
}
