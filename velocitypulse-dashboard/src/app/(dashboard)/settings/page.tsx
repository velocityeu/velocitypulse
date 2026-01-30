'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { UserProfile } from '@clerk/nextjs'
import { Sun, Moon, Monitor, Settings as SettingsIcon, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type TabType = 'appearance' | 'account'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('appearance')
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const tabs = [
    { id: 'appearance' as TabType, label: 'Appearance', icon: Palette },
    { id: 'account' as TabType, label: 'Account', icon: SettingsIcon },
  ]

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun, description: 'Classic light theme' },
    { value: 'dark', label: 'Dark', icon: Moon, description: 'Easy on the eyes' },
    { value: 'system', label: 'System', icon: Monitor, description: 'Match your device' },
  ]

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Choose your preferred color scheme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {themeOptions.map(option => {
                  const Icon = option.icon
                  const isActive = theme === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                        isActive
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <Icon className={`h-6 w-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground text-center">{option.description}</span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="max-w-2xl">
          <UserProfile
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none border rounded-lg',
              },
            }}
          />
        </div>
      )}
    </div>
  )
}
