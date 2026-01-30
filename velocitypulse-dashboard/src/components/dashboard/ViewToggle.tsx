'use client'

import { LayoutGrid, List, Grid3X3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ViewMode } from '@/types'
import { cn } from '@/lib/utils'

interface ViewToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  className?: string
}

const viewModes: { mode: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { mode: 'grid', icon: LayoutGrid, label: 'Grid' },
  { mode: 'list', icon: List, label: 'List' },
  { mode: 'compact', icon: Grid3X3, label: 'Compact' },
]

export function ViewToggle({ viewMode, onViewModeChange, className }: ViewToggleProps) {
  return (
    <div className={cn('inline-flex items-center rounded-lg border bg-card p-1', className)}>
      {viewModes.map(({ mode, icon: Icon, label }) => (
        <Button
          key={mode}
          variant="ghost"
          size="sm"
          onClick={() => onViewModeChange(mode)}
          className={cn(
            'h-7 px-2.5 gap-1.5 text-xs',
            viewMode === mode
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          title={label}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
    </div>
  )
}
