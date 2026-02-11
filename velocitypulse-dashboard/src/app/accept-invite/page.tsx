'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { useCurrentUser } from '@/lib/contexts/UserContext'
import { Loader2, CheckCircle2, XCircle, Mail, AlertTriangle, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface InvitationMeta {
  id: string
  email: string
  type: 'member' | 'admin'
  role: string
  status: string
  orgName: string | null
  expired: boolean
  expiresAt: string
}

export default function AcceptInvitePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    }>
      <AcceptInvitePage />
    </Suspense>
  )
}

function AcceptInvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { signOut } = useClerk()
  const { user, isSignedIn, isLoading: userLoading } = useCurrentUser()
  const isLoaded = !userLoading
  const token = searchParams.get('token')

  const [invitation, setInvitation] = useState<InvitationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wrongAccount, setWrongAccount] = useState(false)
  const [accepted, setAccepted] = useState(false)

  // Fetch invitation metadata
  useEffect(() => {
    if (!token) {
      setError('No invitation token provided')
      setLoading(false)
      return
    }

    fetch(`/api/invitations/verify?token=${token}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Invalid invitation')
        setInvitation(data.invitation)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to verify invitation')
      })
      .finally(() => setLoading(false))
  }, [token])

  // Auto-accept when signed in
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !invitation || accepting || accepted) return
    if (invitation.status !== 'pending' || invitation.expired) return

    setAccepting(true)
    fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) {
          // Detect "wrong account" error (403 with email mismatch)
          if (res.status === 403 && data.error?.includes('different email')) {
            setWrongAccount(true)
          }
          throw new Error(data.error || 'Failed to accept invitation')
        }
        setAccepted(true)
        // Redirect after a short delay
        setTimeout(() => {
          router.push(data.redirectUrl || '/dashboard')
        }, 2000)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to accept invitation')
      })
      .finally(() => setAccepting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, invitation, token, accepting, accepted])

  const redirectUrl = `/accept-invite?token=${token}`
  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
  const signUpUrl = `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`

  const roleLabel = invitation?.role
    ? invitation.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 px-6 text-center">
          {loading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Verifying invitation...</p>
            </>
          ) : error && wrongAccount ? (
            <>
              <LogOut className="h-10 w-10 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Wrong Account</h2>
              <p className="text-sm text-muted-foreground mb-2">
                You&apos;re signed in as <strong>{user?.email || 'a different account'}</strong>.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                This invitation was sent to <strong>{invitation?.email}</strong>.
                Please switch to that account to accept.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => signOut({ redirectUrl: `/accept-invite?token=${token}` })}>
                  Switch Account
                </Button>
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </>
          ) : error ? (
            <>
              <XCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Invitation Error</h2>
              <p className="text-sm text-muted-foreground mb-6">{error}</p>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            </>
          ) : accepted ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Invitation Accepted!</h2>
              <p className="text-sm text-muted-foreground">
                {invitation?.type === 'member'
                  ? `You've joined ${invitation.orgName || 'the organization'} as a ${roleLabel}.`
                  : `You've been granted admin access as a ${roleLabel}.`}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Redirecting...</p>
            </>
          ) : accepting ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Accepting invitation...</p>
            </>
          ) : invitation?.status !== 'pending' ? (
            <>
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">
                {invitation?.status === 'accepted'
                  ? 'Already Accepted'
                  : invitation?.status === 'revoked'
                  ? 'Invitation Revoked'
                  : 'Invitation Expired'}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {invitation?.status === 'accepted'
                  ? 'This invitation has already been used.'
                  : invitation?.status === 'revoked'
                  ? 'This invitation has been revoked by the sender.'
                  : 'This invitation has expired. Please ask for a new one.'}
              </p>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            </>
          ) : invitation?.expired ? (
            <>
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Invitation Expired</h2>
              <p className="text-sm text-muted-foreground mb-6">
                This invitation has expired. Please ask the sender to resend it.
              </p>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            </>
          ) : !isLoaded ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Loading...</p>
            </>
          ) : !isSignedIn ? (
            // Not signed in — show invitation details + auth buttons
            <>
              <Mail className="h-10 w-10 text-primary mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">
                {invitation.type === 'member'
                  ? `You're invited to join ${invitation.orgName || 'an organization'}`
                  : "You're invited as a VelocityPulse admin"}
              </h2>
              <p className="text-sm text-muted-foreground mb-1">
                Invited as: <strong>{roleLabel}</strong>
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Email: {invitation.email}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Sign in or create an account to accept this invitation.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => router.push(signInUrl)}>
                  Sign In
                </Button>
                <Button variant="outline" onClick={() => router.push(signUpUrl)}>
                  Create Account
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
