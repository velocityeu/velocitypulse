'use client'

import { cn } from '@/lib/utils'
import type { Category, Device } from '@/types'

interface CategoryChipsProps {
  categories: Category[]
  devices: Device[]
  selectedCategory: string | null
  onSelectCategory: (categoryId: string | null) => void
}

export function CategoryChips({
  categories,
  devices,
  selectedCategory,
  onSelectCategory,
}: CategoryChipsProps) {
  // Count devices per category
  const categoryCounts = new Map<string, number>()
  devices.forEach(device => {
    if (device.category_id) {
      categoryCounts.set(
        device.category_id,
        (categoryCounts.get(device.category_id) || 0) + 1
      )
    }
  })

  // Only show categories that have devices
  const activeCategories = categories.filter(
    cat => categoryCounts.get(cat.id) && categoryCounts.get(cat.id)! > 0
  )

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {/* All chip */}
      <button
        onClick={() => onSelectCategory(null)}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
          selectedCategory === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
      >
        All
        <span
          className={cn(
            'rounded-full px-1.5 text-xs',
            selectedCategory === null
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : 'bg-background text-foreground'
          )}
        >
          {devices.length}
        </span>
      </button>

      {/* Category chips */}
      {activeCategories.map(category => {
        const count = categoryCounts.get(category.id) || 0
        const isSelected = selectedCategory === category.id

        return (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              isSelected
                ? 'text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            style={
              isSelected
                ? { backgroundColor: category.color }
                : undefined
            }
          >
            {category.name}
            <span
              className={cn(
                'rounded-full px-1.5 text-xs',
                isSelected
                  ? 'bg-white/20 text-white'
                  : 'bg-background text-foreground'
              )}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
