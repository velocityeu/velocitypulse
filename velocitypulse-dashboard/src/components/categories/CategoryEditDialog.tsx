'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CATEGORY_ICONS, getCategoryIcon } from '@/lib/category-icons'
import type { Category } from '@/types'

interface CategoryEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category | null
  onSave: (category: Partial<Category>) => Promise<void>
}

export function CategoryEditDialog({
  open,
  onOpenChange,
  category,
  onSave,
}: CategoryEditDialogProps) {
  const isEditing = !!category

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [icon, setIcon] = useState('box')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens/closes or category changes
  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name || '')
        setSlug(category.slug || '')
        setIcon(category.icon || 'box')
        setDescription(category.description || '')
      } else {
        setName('')
        setSlug('')
        setIcon('box')
        setDescription('')
      }
      setError(null)
    }
  }, [open, category])

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    if (!isEditing) {
      setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Category name is required')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        slug: slug.trim() || undefined,
        icon: icon || 'box',
        description: description.trim() || undefined,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the category information below'
              : 'Create a new category to organize your devices'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g., Servers"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Slug</label>
            <Input
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="e.g., servers"
              className="mt-1 font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL-friendly identifier (auto-generated from name)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Icon</label>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {CATEGORY_ICONS.map(iconConfig => {
                const Icon = iconConfig.icon
                const isSelected = icon === iconConfig.id
                return (
                  <button
                    key={iconConfig.id}
                    type="button"
                    onClick={() => setIcon(iconConfig.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:border-muted-foreground/30 hover:bg-muted/50'
                    }`}
                    title={iconConfig.label}
                  >
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${iconConfig.color}20` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: iconConfig.color }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                      {iconConfig.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
