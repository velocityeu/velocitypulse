'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Pause,
  Play,
  XCircle,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { ConfirmActionDialog } from '@/components/internal/ConfirmActionDialog'

interface SubscriptionDetail {
  id: string
  organization_id: string
  organization: {
    id: string
    name: string
    slug: string
    customer_number: string
    stripe_customer_id?: string
    plan: string
    status: string
  }
  stripe_subscription_id: string
  plan: string
  status: string
  amount_cents: number
  current_period_start: string
  current_period_end: string
  created_at: string
  updated_at: string
}

interface StripeDetails {
  status: string
  cancel_at_period_end: boolean
  canceled_at: number | null
  current_period_start: number
  current_period_end: number
  default_payment_method: {
    type: string
    card: {
      brand: string
      last4: string
      exp_month: number
      exp_year: number
    } | null
  } | null
  latest_invoice: {
    id: string
    status: string
    amount_due: number
    hosted_invoice_url: string | null
  } | null
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-500',
  past_due: 'bg-orange-500/10 text-orange-500',
  cancelled: 'bg-gray-500/10 text-gray-500',
  canceled: 'bg-gray-500/10 text-gray-500',
  incomplete: 'bg-yellow-500/10 text-yellow-500',
  paused: 'bg-blue-500/10 text-blue-500',
}

export default function SubscriptionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [subscription, setSubscription] = useState<SubscriptionDetail | null>(null)
  const [stripeDetails, setStripeDetails] = useState<StripeDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    description: string
    confirmLabel: string
    variant: 'default' | 'destructive'
    action: string
    payload?: Record<string, unknown>
  } | null>(null)

  useEffect(() => {
    loadSubscription()
  }, [params.id])

  async function loadSubscription() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/internal/subscriptions/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setSubscription(data.subscription)
        setStripeDetails(data.stripe)
      }
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function performAction(action: string, payload?: Record<string, unknown>) {
    setActionLoading(action)
    try {
      const res = await fetch(`/api/internal/subscriptions/${params.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      if (res.ok) {
        await loadSubscription()
      } else {
        const data = await res.json()
        alert(data.error || 'Action failed')
      }
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Subscription Not Found</h1>
        </div>
      </div>
    )
  }

  const org = subscription.organization

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Subscription Details</h1>
            <Badge className={statusColors[subscription.status] || 'bg-gray-500/10 text-gray-500'}>
              {subscription.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {org.name} ({org.customer_number}) &middot; {subscription.plan} plan
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subscription Info */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">Plan</div>
                <div className="font-medium capitalize">{subscription.plan}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Amount</div>
                <div className="font-medium">{formatCurrency(subscription.amount_cents)}/yr</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Current Period</div>
                <div className="font-medium">
                  {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <div className="font-medium">{formatDateTime(subscription.created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Stripe ID</div>
                <div className="font-mono text-sm">{subscription.stripe_subscription_id}</div>
              </div>
              {stripeDetails?.cancel_at_period_end && (
                <div>
                  <div className="text-sm text-muted-foreground">Cancels At Period End</div>
                  <Badge className="bg-orange-500/10 text-orange-500">Yes</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Method */}
          {stripeDetails?.default_payment_method?.card && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium capitalize">
                      {stripeDetails.default_payment_method.card.brand} ending in {stripeDetails.default_payment_method.card.last4}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Expires {stripeDetails.default_payment_method.card.exp_month}/{stripeDetails.default_payment_method.card.exp_year}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Latest Invoice */}
          {stripeDetails?.latest_invoice && (
            <Card>
              <CardHeader>
                <CardTitle>Latest Invoice</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm">{stripeDetails.latest_invoice.id}</div>
                    <div className="text-sm text-muted-foreground">
                      Status: {stripeDetails.latest_invoice.status} &middot;
                      Amount: {formatCurrency(stripeDetails.latest_invoice.amount_due)}
                    </div>
                  </div>
                  {stripeDetails.latest_invoice.hosted_invoice_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={stripeDetails.latest_invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                        View Invoice
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Organization Link */}
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{org.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {org.customer_number} &middot; {org.plan} plan &middot; {org.status}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push(`/internal/organizations/${org.id}`)}>
                  View Organization
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Open in Stripe */}
              {subscription.stripe_subscription_id && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a
                    href={`https://dashboard.stripe.com/subscriptions/${subscription.stripe_subscription_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Open in Stripe
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={loadSubscription}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <hr className="my-2" />

              {/* Suspend / Resume */}
              {subscription.status === 'active' && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-orange-600"
                  onClick={() => setConfirmDialog({
                    title: 'Suspend Subscription',
                    description: 'This will pause billing and suspend the organization. Users will lose access.',
                    confirmLabel: 'Suspend',
                    variant: 'destructive',
                    action: 'suspend',
                  })}
                  disabled={!!actionLoading}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Suspend
                </Button>
              )}

              {(subscription.status === 'active' || subscription.status === 'past_due') && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setConfirmDialog({
                    title: 'Change Plan',
                    description: `Switch from ${subscription.plan} to ${subscription.plan === 'starter' ? 'unlimited' : 'starter'}? Prorations will be applied.`,
                    confirmLabel: 'Change Plan',
                    variant: 'default',
                    action: 'change_plan',
                    payload: { plan: subscription.plan === 'starter' ? 'unlimited' : 'starter' },
                  })}
                  disabled={!!actionLoading}
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Change to {subscription.plan === 'starter' ? 'Unlimited' : 'Starter'}
                </Button>
              )}

              {org.status === 'suspended' && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-green-600"
                  onClick={() => performAction('resume')}
                  disabled={!!actionLoading}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}

              <hr className="my-2" />

              {/* Cancel */}
              {subscription.status !== 'cancelled' && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => setConfirmDialog({
                    title: 'Cancel Subscription',
                    description: 'This will immediately cancel the subscription in Stripe. The organization will lose access at the end of the billing period.',
                    confirmLabel: 'Cancel Subscription',
                    variant: 'destructive',
                    action: 'cancel',
                  })}
                  disabled={!!actionLoading}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Subscription
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirm Action Dialog */}
      <ConfirmActionDialog
        open={!!confirmDialog}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}
        title={confirmDialog?.title || ''}
        description={confirmDialog?.description || ''}
        confirmLabel={confirmDialog?.confirmLabel || 'Confirm'}
        variant={confirmDialog?.variant || 'default'}
        onConfirm={async () => {
          if (confirmDialog) {
            await performAction(confirmDialog.action, confirmDialog.payload)
          }
        }}
      />
    </div>
  )
}
