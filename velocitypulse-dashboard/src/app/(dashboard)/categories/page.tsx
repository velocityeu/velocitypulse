'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Trash2, Pencil, GripVertical, RefreshCw,
  Loader2, AlertCircle, FolderOpen
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CategoryEditDialog } from '@/components/categories/CategoryEditDialog'
import { CategoryIconDisplay, CategoryIconBadge } from '@/lib/category-icons'
import type { Category } from '@/types'

interface CategoryWithCount extends Category {
  device_count?: number
}

// Sortable category item
function SortableCategoryItem({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryWithCount
  onEdit: () => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-3 bg-card border rounded-lg ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Icon in colored square */}
      <CategoryIconDisplay iconId={category.icon} size="md" />

      {/* Name and slug */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{category.name}</p>
        <p className="text-sm text-muted-foreground font-mono truncate">{category.slug}</p>
      </div>

      {/* Icon type badge */}
      <CategoryIconBadge iconId={category.icon} />

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null)

  // Delete dialog
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryWithCount | null>(null)
  const [deletingCategory, setDeletingCategory] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load categories
  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/categories')
      if (!res.ok) throw new Error('Failed to load categories')
      const data = await res.json()
      setCategories(data.categories || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex(c => c.id === active.id)
      const newIndex = categories.findIndex(c => c.id === over.id)

      const newCategories = arrayMove(categories, oldIndex, newIndex)
      setCategories(newCategories)

      // Save new order to server
      try {
        const res = await fetch('/api/dashboard/categories/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: newCategories.map(c => c.id) }),
        })
        if (!res.ok) throw new Error('Failed to save order')
      } catch (err) {
        // Revert on error
        setError(err instanceof Error ? err.message : 'Failed to save order')
        loadCategories()
      }
    }
  }

  // Save category (create or update)
  const handleSaveCategory = async (categoryData: Partial<Category>) => {
    if (editingCategory) {
      // Update
      const res = await fetch(`/api/dashboard/categories/${editingCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update category')
      setCategories(prev => prev.map(c => c.id === editingCategory.id ? data.category : c))
    } else {
      // Create
      const res = await fetch('/api/dashboard/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create category')
      setCategories(prev => [...prev, data.category])
    }
  }

  // Delete category
  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return
    setDeletingCategory(true)
    try {
      const res = await fetch(`/api/dashboard/categories/${categoryToDelete.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete category')
      }
      setCategories(prev => prev.filter(c => c.id !== categoryToDelete.id))
      setCategoryToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    } finally {
      setDeletingCategory(false)
    }
  }

  // Open add dialog
  const openAddDialog = () => {
    setEditingCategory(null)
    setEditDialogOpen(true)
  }

  // Open edit dialog
  const openEditDialog = (category: CategoryWithCount) => {
    setEditingCategory(category)
    setEditDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Organize devices into categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadCategories} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            Dismiss
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : categories.length === 0 ? (
        /* Empty state */
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No categories yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create categories to organize your devices
            </p>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first category
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Category list with drag-reorder */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {categories.map(category => (
                <SortableCategoryItem
                  key={category.id}
                  category={category}
                  onEdit={() => openEditDialog(category)}
                  onDelete={() => setCategoryToDelete(category)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Edit/Add Dialog */}
      <CategoryEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        category={editingCategory}
        onSave={handleSaveCategory}
      />

      {/* Delete Dialog */}
      <Dialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{categoryToDelete?.name}&quot;?
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
            <p className="text-muted-foreground">
              Devices in this category will be uncategorized. This action cannot be undone.
            </p>
            {(categoryToDelete?.device_count || 0) > 0 && (
              <p className="mt-2 font-medium text-destructive">
                {categoryToDelete?.device_count} device{(categoryToDelete?.device_count || 0) !== 1 ? 's' : ''} will be uncategorized.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryToDelete(null)} disabled={deletingCategory}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={deletingCategory}>
              {deletingCategory ? 'Deleting...' : 'Delete Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
