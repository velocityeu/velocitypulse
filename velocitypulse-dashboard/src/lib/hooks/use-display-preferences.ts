'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ViewMode } from '@/types'

const STORAGE_KEY = 'velocitypulse-display-preferences'

interface DisplayPreferences {
  viewMode: ViewMode
  groupBySegment: boolean
}

const defaultPreferences: DisplayPreferences = {
  viewMode: 'grid',
  groupBySegment: false,
}

export function useDisplayPreferences() {
  const [preferences, setPreferences] = useState<DisplayPreferences>(defaultPreferences)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DisplayPreferences>
        setPreferences({
          ...defaultPreferences,
          ...parsed,
        })
      }
    } catch (error) {
      console.error('Failed to load display preferences:', error)
    }
    setIsLoaded(true)
  }, [])

  // Save preferences to localStorage when they change
  const savePreferences = useCallback((newPrefs: DisplayPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs))
    } catch (error) {
      console.error('Failed to save display preferences:', error)
    }
  }, [])

  const setViewMode = useCallback((viewMode: ViewMode) => {
    setPreferences((prev) => {
      const newPrefs = { ...prev, viewMode }
      savePreferences(newPrefs)
      return newPrefs
    })
  }, [savePreferences])

  const setGroupBySegment = useCallback((groupBySegment: boolean) => {
    setPreferences((prev) => {
      const newPrefs = { ...prev, groupBySegment }
      savePreferences(newPrefs)
      return newPrefs
    })
  }, [savePreferences])

  return {
    viewMode: preferences.viewMode,
    groupBySegment: preferences.groupBySegment,
    setViewMode,
    setGroupBySegment,
    isLoaded,
  }
}
