'use client'

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SortField, SortDirection } from '@/types'
import { cn } from '@/lib/utils'

interface SortControlsProps {
  sortField: SortField
  sortDirection: SortDirection
  onSortFieldChange: (field: SortField) => void
  onSortDirectionChange: (direction: SortDirection) => void
  className?: string
}

const sortFields: { field: SortField; label: string }[] = [
  { field: 'name', label: 'Name' },
  { field: 'ip_address', label: 'IP Address' },
  { field: 'status', label: 'Status' },
  { field: 'response_time_ms', label: 'Response Time' },
  { field: 'last_check', label: 'Last Check' },
]

export function SortControls({
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
  className,
}: SortControlsProps) {
  const currentSort = sortFields.find(s => s.field === sortField) || sortFields[0]

  const toggleDirection = () => {
    onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')
  }

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden sm:inline">Sort by:</span>
            <span className="font-medium">{currentSort.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {sortFields.map(({ field, label }) => (
            <DropdownMenuItem
              key={field}
              onClick={() => onSortFieldChange(field)}
              className={cn(
                'cursor-pointer',
                sortField === field && 'bg-accent'
              )}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={toggleDirection}
        title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sortDirection === 'asc' ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
