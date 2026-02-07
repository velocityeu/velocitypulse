'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { UserProfile } from '@clerk/nextjs'
import { Sun, Moon, Monitor, Settings as SettingsIcon, Palette, Paintbrush, Shield, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { PLAN_LIMITS } from '@/lib/constants'
import type { OrganizationPlan } from '@/types'

type TabType = 'appearance' | 'account' | 'branding' | 'sso'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('appearance')
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { organization, refetch } = useOrganization()

  useEffect(() => {
    setMounted(true)
  }, [])

  const plan = (organization?.plan || 'trial') as OrganizationPlan
  const canWhiteLabel = PLAN_LIMITS[plan]?.whiteLabel ?? false
  const canSSO = PLAN_LIMITS[plan]?.sso ?? false

  const tabs = [
    { id: 'appearance' as TabType, label: 'Appearance', icon: Palette, show: true },
    { id: 'account' as TabType, label: 'Account', icon: SettingsIcon, show: true },
    { id: 'branding' as TabType, label: 'Branding', icon: Paintbrush, show: canWhiteLabel },
    { id: 'sso' as TabType, label: 'SSO', icon: Shield, show: canSSO },
  ].filter(t => t.show)

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

      {/* Branding Tab (Unlimited only) */}
      {activeTab === 'branding' && canWhiteLabel && (
        <BrandingTab organization={organization} onSave={refetch} />
      )}

      {/* SSO Tab (Unlimited only) */}
      {activeTab === 'sso' && canSSO && (
        <SSOTab />
      )}
    </div>
  )
}

// --- Branding Tab Component ---

function BrandingTab({ organization, onSave }: { organization: ReturnType<typeof useOrganization>['organization']; onSave: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(organization?.branding_display_name || '')
  const [logoUrl, setLogoUrl] = useState(organization?.branding_logo_url || '')
  const [primaryColor, setPrimaryColor] = useState(organization?.branding_primary_color || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/dashboard/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName || null,
          logo_url: logoUrl || null,
          primary_color: primaryColor || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save branding')
      }

      setSuccess(true)
      await onSave()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setDisplayName('')
    setLogoUrl('')
    setPrimaryColor('')

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/dashboard/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: null,
          logo_url: null,
          primary_color: null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reset branding')
      }

      setSuccess(true)
      await onSave()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>White-Label Branding</CardTitle>
          <CardDescription>
            Customize the dashboard appearance with your own brand. Leave fields empty to use VelocityPulse defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Display Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="VelocityPulse"
              maxLength={255}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">Shown in the header and sidebar</p>
          </div>

          {/* Logo URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Logo URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">Must be HTTPS. Recommended size: 32x32px</p>
            {logoUrl && logoUrl.startsWith('https://') && (
              <div className="flex items-center gap-2 mt-2 p-2 rounded border bg-muted/50">
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-8 w-8 rounded object-contain"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="text-xs text-muted-foreground">Preview</span>
              </div>
            )}
          </div>

          {/* Primary Color */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor || '#000000'}
                onChange={e => setPrimaryColor(e.target.value)}
                className="h-10 w-10 rounded border cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                placeholder="#000000"
                pattern="^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$"
                className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">Hex color code for accent elements</p>
          </div>

          {/* Error/Success messages */}
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm">
              Branding saved successfully
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Branding
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- SSO Tab Component ---

function SSOTab() {
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [domain, setDomain] = useState('')
  const [metadataUrl, setMetadataUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<{ acs_url?: string; entity_id?: string } | null>(null)

  // Fetch current SSO config
  useEffect(() => {
    async function fetchSSO() {
      try {
        const response = await fetch('/api/dashboard/sso')
        if (response.ok) {
          const data = await response.json()
          setSsoEnabled(data.sso_enabled)
          setDomain(data.sso_domain || '')
        }
      } catch {
        // Non-fatal
      } finally {
        setLoading(false)
      }
    }
    fetchSSO()
  }, [])

  const handleEnable = async () => {
    if (!domain) {
      setError('Domain is required')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/dashboard/sso', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          idp_metadata_url: metadataUrl || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable SSO')
      }

      setSsoEnabled(true)
      setSuccess(true)
      if (data.acs_url || data.entity_id) {
        setConnectionInfo({ acs_url: data.acs_url, entity_id: data.entity_id })
      }
      setTimeout(() => setSuccess(false), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable SSO')
    } finally {
      setSaving(false)
    }
  }

  const handleDisable = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/dashboard/sso', { method: 'DELETE' })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disable SSO')
      }

      setSsoEnabled(false)
      setDomain('')
      setMetadataUrl('')
      setConnectionInfo(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable SSO')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>SSO / SAML Authentication</CardTitle>
          <CardDescription>
            Enable single sign-on for your organization. Users with matching email domains will be
            directed to your identity provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable/Disable toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium text-sm">SSO Status</p>
              <p className="text-xs text-muted-foreground">
                {ssoEnabled ? 'SSO is enabled for your organization' : 'SSO is not configured'}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              ssoEnabled
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            }`}>
              {ssoEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>

          {/* Domain */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="acme.com"
              disabled={ssoEnabled}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">
              Users with @{domain || 'yourdomain.com'} emails will use SSO
            </p>
          </div>

          {/* Metadata URL */}
          {!ssoEnabled && (
            <div className="space-y-2">
              <label className="text-sm font-medium">SAML Metadata URL (optional)</label>
              <input
                type="url"
                value={metadataUrl}
                onChange={e => setMetadataUrl(e.target.value)}
                placeholder="https://idp.acme.com/metadata.xml"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Your IdP&apos;s SAML metadata URL for automatic configuration
              </p>
            </div>
          )}

          {/* Connection Info (shown after enabling) */}
          {connectionInfo && (
            <div className="p-3 rounded-lg border bg-muted/50 space-y-2">
              <p className="text-sm font-medium">IdP Configuration Details</p>
              <p className="text-xs text-muted-foreground">Use these values to configure your identity provider:</p>
              {connectionInfo.acs_url && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">ACS URL</p>
                  <code className="text-xs bg-background px-2 py-1 rounded border block break-all">
                    {connectionInfo.acs_url}
                  </code>
                </div>
              )}
              {connectionInfo.entity_id && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Entity ID</p>
                  <code className="text-xs bg-background px-2 py-1 rounded border block break-all">
                    {connectionInfo.entity_id}
                  </code>
                </div>
              )}
            </div>
          )}

          {/* Error/Success */}
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm">
              SSO configuration updated successfully
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!ssoEnabled ? (
              <Button onClick={handleEnable} disabled={saving || !domain}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enable SSO
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleDisable} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Disable SSO
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
