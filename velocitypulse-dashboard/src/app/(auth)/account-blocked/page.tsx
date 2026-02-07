'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Ban, Loader2, CreditCard, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AccountBlockedPage() {
  const router = useRouter()
  const [orgStatus, setOrgStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch('/api/onboarding')
        if (!response.ok) {
          setLoading(false)
          return
        }
        const data = await response.json()
        if (data.organization) {
          setOrgStatus(data.organization.status)
          // If org is actually active/trial (not expired), redirect to dashboard
          if (data.organization.status === 'active' || data.organization.status === 'trial') {
            router.push('/dashboard')
            return
          }
        }
      } catch {
        // Continue showing blocked page
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [router])

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // Portal not available
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isSuspended = orgStatus === 'suspended'
  const isCancelled = orgStatus === 'cancelled'

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            {isCancelled ? (
              <Ban className="h-8 w-8 text-destructive" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-destructive" />
            )}
          </div>
          <CardTitle className="text-xl">
            {isCancelled ? 'Account Cancelled' : 'Account Suspended'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {isSuspended && (
            <>
              <p className="text-muted-foreground">
                Your account has been suspended due to a billing issue. Please update your payment method to restore access.
              </p>
              <Button onClick={handleManageBilling} disabled={portalLoading} className="w-full">
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Update Payment
              </Button>
            </>
          )}

          {isCancelled && (
            <p className="text-muted-foreground">
              Your account has been cancelled. Your data will be retained for 30 days. Please contact support if you wish to reactivate your account.
            </p>
          )}

          <Button variant="outline" className="w-full" asChild>
            <a href="mailto:support@velocitypulse.io">
              <Mail className="h-4 w-4 mr-2" />
              Contact Support
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
