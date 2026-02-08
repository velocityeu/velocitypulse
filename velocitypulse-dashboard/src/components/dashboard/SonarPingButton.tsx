'use client'

import { Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SonarPingButtonProps {
  isPinging: boolean
  onClick: () => void
  variant?: 'icon' | 'text'
  label?: string
  disabled?: boolean
  className?: string
}

export function SonarPingButton({
  isPinging,
  onClick,
  variant = 'icon',
  label = 'Ping',
  disabled = false,
  className,
}: SonarPingButtonProps) {
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
      </Button>
    )
  }

  return (
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
  )
}
