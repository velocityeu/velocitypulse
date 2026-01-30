'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor, LayoutGrid, List, Rows3, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDisplayPreferences } from '@/lib/hooks/use-display-preferences'
import type { ViewMode } from '@/types'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { viewMode, setViewMode, groupBySegment, setGroupBySegment } = useDisplayPreferences()

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  const viewModeOptions: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
    { value: 'grid', label: 'Grid', icon: LayoutGrid },
    { value: 'list', label: 'List', icon: List },
    { value: 'compact', label: 'Compact', icon: Rows3 },
  ]

  if (!mounted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look of your dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize the look of your dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">
                Theme
              </label>
              <div className="flex gap-2">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const isActive = theme === option.value
                  return (
                    <Button
                      key={option.value}
                      variant={isActive ? 'default' : 'outline'}
                      onClick={() => setTheme(option.value)}
                      className="flex-1 gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Display */}
        <Card>
          <CardHeader>
            <CardTitle>Display</CardTitle>
            <CardDescription>Configure how devices are displayed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">
                Default View Mode
              </label>
              <div className="flex gap-2">
                {viewModeOptions.map((option) => {
                  const Icon = option.icon
                  const isActive = viewMode === option.value
                  return (
                    <Button
                      key={option.value}
                      variant={isActive ? 'default' : 'outline'}
                      onClick={() => setViewMode(option.value)}
                      className="flex-1 gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </Button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground block">
                  Group by Network Segment
                </label>
                <p className="text-sm text-muted-foreground">
                  Organize devices by their network segment
                </p>
              </div>
              <Button
                variant={groupBySegment ? 'default' : 'outline'}
                onClick={() => setGroupBySegment(!groupBySegment)}
                size="sm"
              >
                {groupBySegment ? 'On' : 'Off'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="gap-2" asChild>
              <a href="/user" target="_blank" rel="noopener noreferrer">
                <User className="h-4 w-4" />
                Manage Account
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
