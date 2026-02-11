'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'

export interface PingResult {
  status: 'pending' | 'success' | 'error' | 'timeout'
  latencyMs?: number
  error?: string
}

const POLL_INTERVAL = 500
const POLL_TIMEOUT = 10000
const MIN_ANIMATION_MS = 800
const RESULT_DISPLAY_MS = 5000

export function useSonarPing() {
  const [pingingAgents, setPingingAgents] = useState<Set<string>>(new Set())
  const [pingResults, setPingResults] = useState<Map<string, PingResult>>(new Map())
  const [audioEnabled, setAudioEnabled] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pollTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/sounds/sonar-ping.mp3')
      audioRef.current.volume = 0.3
    }
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of pollTimers.current.values()) {
        clearTimeout(timer)
      }
    }
  }, [])

  const playSound = useCallback(() => {
    if (audioEnabled && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        // Audio play may fail without user gesture
      })
    }
  }, [audioEnabled])

  const stopPinging = useCallback((agentId: string) => {
    setPingingAgents(prev => {
      const next = new Set(prev)
      next.delete(agentId)
      return next
    })
  }, [])

  const clearResult = useCallback((agentId: string) => {
    setPingResults(prev => {
      const next = new Map(prev)
      next.delete(agentId)
      return next
    })
  }, [])

  const pollForResult = useCallback((agentId: string, commandId: string, startTime: number) => {
    const poll = async () => {
      const elapsed = Date.now() - startTime

      // Timeout after POLL_TIMEOUT
      if (elapsed > POLL_TIMEOUT) {
        setPingResults(prev => new Map(prev).set(agentId, { status: 'timeout', error: 'Ping timed out' }))
        stopPinging(agentId)
        // Auto-clear result after display period
        const clearTimer = setTimeout(() => clearResult(agentId), RESULT_DISPLAY_MS)
        pollTimers.current.set(`clear-${agentId}`, clearTimer)
        return
      }

      try {
        const res = await authFetch(`/api/dashboard/agents/${agentId}/commands/${commandId}`)
        if (!res.ok) {
          // Keep polling on transient errors
          const timer = setTimeout(poll, POLL_INTERVAL)
          pollTimers.current.set(agentId, timer)
          return
        }

        const data = await res.json()
        const command = data.command

        if (command.status === 'completed') {
          const latencyMs = command.payload?.round_trip_ms ?? command.payload?.latency_ms ?? command.payload?.delivery_ms
          // Ensure minimum animation duration
          const remaining = Math.max(0, MIN_ANIMATION_MS - (Date.now() - startTime))
          setTimeout(() => {
            setPingResults(prev => new Map(prev).set(agentId, {
              status: 'success',
              latencyMs: typeof latencyMs === 'number' ? latencyMs : undefined,
            }))
            stopPinging(agentId)
            // Auto-clear result after display period
            const clearTimer = setTimeout(() => clearResult(agentId), RESULT_DISPLAY_MS)
            pollTimers.current.set(`clear-${agentId}`, clearTimer)
          }, remaining)
          return
        }

        if (command.status === 'failed') {
          const remaining = Math.max(0, MIN_ANIMATION_MS - (Date.now() - startTime))
          setTimeout(() => {
            setPingResults(prev => new Map(prev).set(agentId, {
              status: 'error',
              error: command.error || 'Ping failed',
            }))
            stopPinging(agentId)
            const clearTimer = setTimeout(() => clearResult(agentId), RESULT_DISPLAY_MS)
            pollTimers.current.set(`clear-${agentId}`, clearTimer)
          }, remaining)
          return
        }

        // Still pending/acknowledged — keep polling
        const timer = setTimeout(poll, POLL_INTERVAL)
        pollTimers.current.set(agentId, timer)
      } catch {
        // Network error — keep polling
        const timer = setTimeout(poll, POLL_INTERVAL)
        pollTimers.current.set(agentId, timer)
      }
    }

    // Start first poll after a short delay
    const timer = setTimeout(poll, POLL_INTERVAL)
    pollTimers.current.set(agentId, timer)
  }, [stopPinging, clearResult])

  const pingAgent = useCallback(async (agentId: string) => {
    // Clear any existing poll/clear timers for this agent
    const existingTimer = pollTimers.current.get(agentId)
    if (existingTimer) clearTimeout(existingTimer)
    const existingClearTimer = pollTimers.current.get(`clear-${agentId}`)
    if (existingClearTimer) clearTimeout(existingClearTimer)

    // Add to pinging set and clear old result
    setPingingAgents(prev => new Set(prev).add(agentId))
    setPingResults(prev => {
      const next = new Map(prev)
      next.set(agentId, { status: 'pending' })
      return next
    })
    playSound()

    const startTime = Date.now()

    try {
      const res = await authFetch(`/api/dashboard/agents/${agentId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command_type: 'ping' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to ping agent')
      }

      const data = await res.json()
      const commandId = data.command?.id

      if (commandId) {
        pollForResult(agentId, commandId, startTime)
      } else {
        // No command ID returned — fall back to timed animation
        setTimeout(() => stopPinging(agentId), MIN_ANIMATION_MS)
      }
    } catch (error) {
      setPingResults(prev => new Map(prev).set(agentId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Ping failed',
      }))
      setTimeout(() => stopPinging(agentId), MIN_ANIMATION_MS)
      const clearTimer = setTimeout(() => clearResult(agentId), RESULT_DISPLAY_MS)
      pollTimers.current.set(`clear-${agentId}`, clearTimer)
    }
  }, [playSound, pollForResult, stopPinging, clearResult])

  const pingAgents = useCallback(async (agentIds: string[]) => {
    if (agentIds.length === 0) return
    playSound()

    // Ping all in parallel
    await Promise.allSettled(agentIds.map(id => pingAgent(id)))
  }, [playSound, pingAgent])

  const getPingResult = useCallback((agentId: string): PingResult | undefined => {
    return pingResults.get(agentId)
  }, [pingResults])

  return {
    pingAgent,
    pingAgents,
    pingingAgents,
    isPinging: (agentId: string) => pingingAgents.has(agentId),
    getPingResult,
    audioEnabled,
    setAudioEnabled,
  }
}
