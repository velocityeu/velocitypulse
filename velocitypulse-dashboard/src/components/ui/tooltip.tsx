'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipProviderProps {
  children: React.ReactNode
  delayDuration?: number
}

interface TooltipProps {
  children: React.ReactNode
}

interface TooltipTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

interface TooltipContentProps {
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

const TooltipContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
  delayDuration: number
}>({
  open: false,
  setOpen: () => {},
  delayDuration: 200,
})

export function TooltipProvider({ children, delayDuration = 200 }: TooltipProviderProps) {
  return (
    <TooltipContext.Provider value={{ open: false, setOpen: () => {}, delayDuration }}>
      {children}
    </TooltipContext.Provider>
  )
}

export function Tooltip({ children }: TooltipProps) {
  const [open, setOpen] = React.useState(false)
  const context = React.useContext(TooltipContext)

  return (
    <TooltipContext.Provider value={{ open, setOpen, delayDuration: context.delayDuration }}>
      <div className="relative inline-flex">{children}</div>
    </TooltipContext.Provider>
  )
}

export function TooltipTrigger({ children, asChild }: TooltipTriggerProps) {
  const { setOpen, delayDuration } = React.useContext(TooltipContext)
  const timeoutRef = React.useRef<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setOpen(true), delayDuration)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setOpen(false)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    })
  }

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
    </div>
  )
}

export function TooltipContent({ children, side = 'top', className }: TooltipContentProps) {
  const { open } = React.useContext(TooltipContext)

  if (!open) return null

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      className={cn(
        'absolute z-50 px-3 py-1.5 text-sm bg-popover text-popover-foreground rounded-md border shadow-md animate-in fade-in-0 zoom-in-95',
        positionClasses[side],
        className
      )}
    >
      {children}
    </div>
  )
}
