'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface UpdatePaymentMethodProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function PaymentForm({ onSuccess, onOpenChange }: { onSuccess: () => void; onOpenChange: (open: boolean) => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    const { error: submitError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    })

    if (submitError) {
      setError(submitError.message || 'Failed to update payment method')
      setSubmitting(false)
      return
    }

    if (setupIntent?.payment_method) {
      const pmId = typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method.id

      const response = await fetch('/api/billing/update-payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId: pmId }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to set default payment method')
        setSubmitting(false)
        return
      }
    }

    setSubmitting(false)
    onSuccess()
    onOpenChange(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || !elements || submitting}>
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating...
            </span>
          ) : (
            'Update Payment Method'
          )}
        </Button>
      </div>
    </form>
  )
}

export function UpdatePaymentMethod({ open, onOpenChange, onSuccess }: UpdatePaymentMethodProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && !clientSecret) {
      setLoading(true)
      setError(null)
      fetch('/api/billing/update-payment', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.clientSecret) {
            setClientSecret(data.clientSecret)
          } else {
            setError(data.error || 'Failed to initialize payment form')
          }
        })
        .catch(() => setError('Failed to initialize payment form'))
        .finally(() => setLoading(false))
    }
    if (!open) {
      setClientSecret(null)
    }
  }, [open, clientSecret])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Payment Method</DialogTitle>
          <DialogDescription>
            Enter your new card details below.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm onSuccess={onSuccess} onOpenChange={onOpenChange} />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  )
}
