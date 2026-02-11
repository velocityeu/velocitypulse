'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/lib/contexts/UserContext'
import {
  CreditCard,
  AlertTriangle,
  Loader2,
  Download,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlanCards } from '@/components/billing/PlanCards'
import { EmbeddedCheckout } from '@/components/billing/EmbeddedCheckout'
import { UpdatePaymentMethod } from '@/components/billing/UpdatePaymentMethod'

interface BillingData {
  subscription: {
    id: string
    status: string
    cancel_at_period_end: boolean
    current_period_end: string
    current_period_start: string
    amount: number
    priceId: string
    plan: string
  } | null
  paymentMethod: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  } | null
  invoices: Array<{
    id: string
    date: string | null
    amount: number
    status: string | null
    pdf: string | null
  }>
  plan: string
  status: string
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

const formatAmount = (cents: number) => `\u00a3${(cents / 100).toFixed(2)}`

export default function BillingPage() {
  const router = useRouter()
  const { user, isLoading: userLoading } = useCurrentUser()
  const isLoaded = !userLoading
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const [organizationId, setOrganizationId] = useState<string>('')
  const [fetchingData, setFetchingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Embedded checkout state (for trial -> paid)
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null)

  // Dialog states
  const [showUpdatePayment, setShowUpdatePayment] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false)
  const [pendingPlanChange, setPendingPlanChange] = useState<{ planId: string; priceId: string } | null>(null)

  // Action loading states
  const [cancelLoading, setCancelLoading] = useState(false)
  const [reactivateLoading, setReactivateLoading] = useState(false)
  const [changePlanLoading, setChangePlanLoading] = useState(false)

  // Fetch billing data
  useEffect(() => {
    async function fetchData() {
      try {
        const [orgResponse, billingResponse] = await Promise.all([
          authFetch('/api/onboarding'),
          authFetch('/api/billing/details'),
        ])

        const orgData = await orgResponse.json()
        if (!orgData.hasOrganization) {
          router.push('/onboarding')
          return
        }
        setOrganizationId(orgData.organization.id)

        if (billingResponse.ok) {
          const data = await billingResponse.json()
          setBillingData(data)
        } else {
          setError('Failed to load billing information')
        }
      } catch (err) {
        console.error('Failed to fetch billing data:', err)
        setError('Failed to load billing information')
      } finally {
        setFetchingData(false)
      }
    }

    if (isLoaded && user) {
      fetchData()
    }
  }, [isLoaded, user, router])

  const refreshBillingData = async () => {
    try {
      const response = await authFetch('/api/billing/details')
      if (response.ok) {
        const data = await response.json()
        setBillingData(data)
      }
    } catch {
      // Silently fail refresh
    }
  }

  const handleSelectPlan = (planId: string, priceId: string | null) => {
    if (!priceId) return

    const currentPlan = billingData?.plan || 'trial'

    if (currentPlan === 'trial') {
      // Trial -> paid: show embedded checkout
      setSelectedPriceId(priceId)
      setShowCheckout(true)
    } else {
      // Paid -> paid: show confirmation dialog
      setPendingPlanChange({ planId, priceId })
      setShowChangePlanDialog(true)
    }
  }

  const handleChangePlan = async () => {
    if (!pendingPlanChange) return

    setChangePlanLoading(true)
    setError(null)

    try {
      const response = await authFetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: pendingPlanChange.priceId }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change plan')
      }

      setShowChangePlanDialog(false)
      setPendingPlanChange(null)
      await refreshBillingData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change plan')
    } finally {
      setChangePlanLoading(false)
    }
  }

  const handleCancel = async () => {
    setCancelLoading(true)
    setError(null)

    try {
      const response = await authFetch('/api/billing/cancel', {
        method: 'POST',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      setShowCancelDialog(false)
      await refreshBillingData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setCancelLoading(false)
    }
  }

  const handleReactivate = async () => {
    setReactivateLoading(true)
    setError(null)

    try {
      const response = await authFetch('/api/billing/reactivate', {
        method: 'POST',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reactivate subscription')
      }

      await refreshBillingData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate subscription')
    } finally {
      setReactivateLoading(false)
    }
  }

  if (!isLoaded || fetchingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const currentPlan = billingData?.plan || 'trial'
  const subscription = billingData?.subscription
  const paymentMethod = billingData?.paymentMethod
  const invoices = billingData?.invoices || []

  // If showing embedded checkout (trial -> paid)
  if (showCheckout && selectedPriceId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Complete Your Subscription</h1>
          <p className="text-muted-foreground">
            Enter your payment details to activate your plan.
          </p>
        </div>

        <EmbeddedCheckout
          priceId={selectedPriceId}
          organizationId={organizationId}
        />

        <div className="text-center mt-4">
          <Button
            variant="ghost"
            onClick={() => {
              setShowCheckout(false)
              setSelectedPriceId(null)
            }}
            className="text-sm text-muted-foreground"
          >
            Back to billing
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your plan, payment method, and invoices.
        </p>
      </div>

      {error && (
        <div className="max-w-2xl mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Payment Failed Warning */}
      {billingData?.status === 'past_due' && (
        <div className="max-w-2xl mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
          <div>
            <p className="font-medium text-orange-500">Payment failed</p>
            <p className="text-sm text-muted-foreground">
              Please update your payment method to avoid service interruption.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 max-w-2xl">
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">
                    {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
                  </span>
                  {subscription ? (
                    <Badge variant={subscription.status === 'active' ? 'default' : 'destructive'}>
                      {subscription.cancel_at_period_end ? 'Cancelling' : subscription.status === 'active' ? 'Active' : 'Past Due'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Trial</Badge>
                  )}
                </div>
                {subscription && (
                  <p className="text-sm text-muted-foreground">
                    {subscription.cancel_at_period_end
                      ? `Cancels on ${formatDate(subscription.current_period_end)}`
                      : `Next renewal: ${formatDate(subscription.current_period_end)}`}
                  </p>
                )}
                {currentPlan === 'trial' && (
                  <p className="text-sm text-muted-foreground">
                    Free 14-day trial
                  </p>
                )}
              </div>
              {subscription && (
                <div className="text-right">
                  <div className="text-2xl font-bold">{formatAmount(subscription.amount)}</div>
                  <p className="text-sm text-muted-foreground">/year</p>
                </div>
              )}
            </div>
          </CardContent>
          {subscription?.cancel_at_period_end && (
            <CardFooter>
              <Button onClick={handleReactivate} disabled={reactivateLoading}>
                {reactivateLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reactivating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Reactivate Subscription
                  </span>
                )}
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Payment Method Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentMethod ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <span className="font-medium capitalize">{paymentMethod.brand}</span>
                    {' '}ending in{' '}
                    <span className="font-mono font-medium">{paymentMethod.last4}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Expires {paymentMethod.exp_month.toString().padStart(2, '0')}/{paymentMethod.exp_year}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No payment method on file</p>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setShowUpdatePayment(true)}>
              {paymentMethod ? 'Update Payment Method' : 'Add Payment Method'}
            </Button>
          </CardFooter>
        </Card>

        {/* Change Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Change Plan</CardTitle>
            <CardDescription>
              {currentPlan === 'trial'
                ? 'Upgrade to a paid plan to unlock more features.'
                : 'Switch to a different plan. Changes take effect immediately.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlanCards
              currentPlan={currentPlan}
              onSelectPlan={handleSelectPlan}
              showTrialCard={false}
            />
          </CardContent>
        </Card>

        {/* Cancel Subscription */}
        {subscription && !subscription.cancel_at_period_end && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cancel Subscription</CardTitle>
              <CardDescription>
                Your access will continue until the end of the current billing period.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="destructive" size="sm" onClick={() => setShowCancelDialog(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Subscription
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Invoice History */}
        {invoices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm">
                        {invoice.date ? formatDate(invoice.date) : 'N/A'}
                      </span>
                      <span className="text-sm font-medium">
                        {formatAmount(invoice.amount)}
                      </span>
                      <Badge
                        variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {invoice.status || 'unknown'}
                      </Badge>
                    </div>
                    {invoice.pdf && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={invoice.pdf} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="max-w-2xl text-center mt-8 text-sm text-muted-foreground">
        <p>All prices exclude VAT. Cancel anytime.</p>
        <p className="mt-2">
          Questions? Contact us at{' '}
          <a href="mailto:support@velocitypulse.io" className="text-primary hover:underline">
            support@velocitypulse.io
          </a>
        </p>
      </div>

      {/* Update Payment Method Dialog */}
      <UpdatePaymentMethod
        open={showUpdatePayment}
        onOpenChange={setShowUpdatePayment}
        onSuccess={refreshBillingData}
      />

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel? Your access will continue until{' '}
              {subscription?.current_period_end
                ? formatDate(subscription.current_period_end)
                : 'the end of your billing period'}
              . After that, your account will be downgraded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={cancelLoading}>
              Keep Subscription
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelLoading}>
              {cancelLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelling...
                </span>
              ) : (
                'Yes, Cancel'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Confirmation Dialog */}
      <Dialog open={showChangePlanDialog} onOpenChange={setShowChangePlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              {pendingPlanChange && (
                <>
                  You are switching to the{' '}
                  <span className="font-semibold">
                    {pendingPlanChange.planId.charAt(0).toUpperCase() + pendingPlanChange.planId.slice(1)}
                  </span>{' '}
                  plan. The change takes effect immediately and your next invoice will be prorated.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowChangePlanDialog(false)
                setPendingPlanChange(null)
              }}
              disabled={changePlanLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePlan} disabled={changePlanLoading}>
              {changePlanLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Changing...
                </span>
              ) : (
                'Confirm Change'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
