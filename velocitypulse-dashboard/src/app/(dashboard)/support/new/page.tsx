'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

const categories = [
  { value: 'technical', label: 'Technical Issue', description: 'Problems with agents, devices, or monitoring' },
  { value: 'billing', label: 'Billing', description: 'Invoices, payments, or charges' },
  { value: 'subscription', label: 'Subscription', description: 'Plan changes, upgrades, or cancellations' },
  { value: 'other', label: 'Other', description: 'General questions or feedback' },
]

const priorities = [
  { value: 'low', label: 'Low', description: 'General question, no urgency' },
  { value: 'normal', label: 'Normal', description: 'Standard request' },
  { value: 'high', label: 'High', description: 'Significant impact on operations' },
  { value: 'urgent', label: 'Urgent', description: 'Critical issue, service down' },
]

export default function NewTicketPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'technical',
    priority: 'normal',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subject.trim() || !form.description.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/dashboard/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/support/${data.ticket.id}`)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create ticket')
      }
    } catch {
      setError('Failed to create ticket. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Support Ticket</h1>
          <p className="text-muted-foreground">Describe your issue and our team will respond promptly</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Ticket Details</CardTitle>
            <CardDescription>All fields are required</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category */}
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      form.category === cat.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="font-medium text-sm">{cat.label}</div>
                    <div className="text-xs text-muted-foreground">{cat.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="text-sm font-medium mb-2 block">Priority</label>
              <div className="flex gap-2">
                {priorities.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                    className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                      form.priority === p.value
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                    title={p.description}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="subject" className="text-sm font-medium mb-2 block">Subject</label>
              <input
                id="subject"
                type="text"
                placeholder="Brief summary of your issue"
                value={form.subject}
                onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                maxLength={300}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="text-sm font-medium mb-2 block">Description</label>
              <textarea
                id="description"
                placeholder="Please describe your issue in detail. Include any relevant error messages, steps to reproduce, or screenshots."
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={6}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting || !form.subject.trim() || !form.description.trim()}>
                {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
