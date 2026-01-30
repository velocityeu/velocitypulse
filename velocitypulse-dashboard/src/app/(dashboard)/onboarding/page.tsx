'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Building2, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user already has an organization
  useEffect(() => {
    async function checkOrganization() {
      try {
        const response = await fetch('/api/onboarding')
        const data = await response.json()

        if (data.hasOrganization) {
          // User already has an org, redirect to dashboard
          router.push('/dashboard')
          return
        }
      } catch (err) {
        console.error('Failed to check organization:', err)
      } finally {
        setChecking(false)
      }
    }

    if (isLoaded && user) {
      checkOrganization()
    }
  }, [isLoaded, user, router])

  // Pre-fill with user's name or email domain
  useEffect(() => {
    if (user && !orgName) {
      const email = user.emailAddresses[0]?.emailAddress
      if (email) {
        const domain = email.split('@')[1]
        if (domain && !['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com'].includes(domain)) {
          // Use domain name as suggestion for business emails
          const domainName = domain.split('.')[0]
          setOrgName(domainName.charAt(0).toUpperCase() + domainName.slice(1))
        }
      }
    }
  }, [user, orgName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!orgName.trim() || orgName.trim().length < 2) {
      setError('Organization name must be at least 2 characters')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName: orgName.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization')
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to VelocityPulse</CardTitle>
          <CardDescription>
            Let&apos;s set up your organization to get started with network monitoring.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="orgName"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Organization Name
              </label>
              <Input
                type="text"
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g., Acme Corp"
                disabled={loading}
                autoFocus
              />
              <p className="mt-2 text-sm text-muted-foreground">
                This is how your organization will appear in VelocityPulse.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !orgName.trim()}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Your 14-day free trial starts now.</p>
            <p>No credit card required.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
