'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'

interface UseSonarPingOptions {
  animationDuration?: number // ms, default 2000
}

export function useSonarPing(options: UseSonarPingOptions = {}) {
  const { animationDuration = 2000 } = options
  const [pingingAgents, setPingingAgents] = useState<Set<string>>(new Set())
  const [audioEnabled, setAudioEnabled] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/sounds/sonar-ping.mp3')
      audioRef.current.volume = 0.3
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

  const pingAgent = useCallback(async (agentId: string) => {
    // Add to pinging set
    setPingingAgents(prev => new Set(prev).add(agentId))
    playSound()

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
    } catch (error) {
      console.error('Ping failed:', error)
    }

    // Remove animation after duration
    setTimeout(() => {
      setPingingAgents(prev => {
        const next = new Set(prev)
        next.delete(agentId)
        return next
      })
    }, animationDuration)
  }, [playSound, animationDuration])

  const pingAgents = useCallback(async (agentIds: string[]) => {
    if (agentIds.length === 0) return
    playSound()

    // Add all to pinging set
    setPingingAgents(prev => {
      const next = new Set(prev)
      agentIds.forEach(id => next.add(id))
      return next
    })

    // Send commands in parallel
    await Promise.allSettled(
      agentIds.map(id =>
        authFetch(`/api/dashboard/agents/${id}/commands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command_type: 'ping' }),
        })
      )
    )

    // Remove all animations after duration
    setTimeout(() => {
      setPingingAgents(prev => {
        const next = new Set(prev)
        agentIds.forEach(id => next.delete(id))
        return next
      })
    }, animationDuration)
  }, [playSound, animationDuration])

  return {
    pingAgent,
    pingAgents,
    pingingAgents,
    isPinging: (agentId: string) => pingingAgents.has(agentId),
    audioEnabled,
    setAudioEnabled,
  }
}
