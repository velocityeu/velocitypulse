'use client'

import { Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PingResult } from '@/lib/hooks/useSonarPing'

interface SonarPingButtonProps {
  isPinging: boolean
  onClick: () => void
  variant?: 'icon' | 'text'
  label?: string
  disabled?: boolean
  className?: string
  result?: PingResult
}

export function SonarPingButton({
  isPinging,
  onClick,
  variant = 'icon',
  label = 'Ping',
  disabled = false,
  className,
  result,
}: SonarPingButtonProps) {
  const resultBadge = result && result.status !== 'pending' && !isPinging ? (
    <span
      className={cn(
        'ml-1 text-xs font-medium px-1.5 py-0.5 rounded-full',
        result.status === 'success' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        (result.status === 'error' || result.status === 'timeout') && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      )}
    >
      {result.status === 'success' && result.latencyMs !== undefined
        ? `${result.latencyMs}ms`
        : result.status === 'timeout'
          ? 'Timeout'
          : result.status === 'error'
            ? 'Error'
            : null}
    </span>
  ) : null

  if (variant === 'text') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={disabled}
        className={cn('relative', className)}
      >
        <span className="relative">
          <Radio className={cn('h-4 w-4 mr-1', isPinging && 'text-primary')} />
          {isPinging && <span className="sonar-ripple absolute inset-0" />}
        </span>
        {label}
        {resultBadge}
      </Button>
    )
  }

  return (
    <span className="inline-flex items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        disabled={disabled}
        className={cn('h-8 w-8 relative', className)}
        title={label}
      >
        <Radio className={cn('h-4 w-4', isPinging && 'text-primary')} />
        {isPinging && <span className="sonar-ripple absolute inset-0 rounded-full" />}
      </Button>
      {resultBadge}
    </span>
  )
}
