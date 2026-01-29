'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Zap, Shield, Clock } from 'lucide-react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

const companySizeOptions = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
]

const deviceCountOptions = [
  { value: '1-25', label: '1-25 devices' },
  { value: '26-50', label: '26-50 devices' },
  { value: '51-100', label: '51-100 devices' },
  { value: '101-500', label: '101-500 devices' },
  { value: '500+', label: '500+ devices' },
]

const benefits = [
  { icon: Check, text: 'Full access to all features' },
  { icon: Clock, text: '30 days free - no credit card' },
  { icon: Zap, text: 'Set up in under 10 minutes' },
  { icon: Shield, text: 'Your data stays private' },
]

export default function DemoPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsSubmitted(true)
    setIsSubmitting(false)
  }

  return (
    <div className="py-16 md:py-24">
      {/* Header */}
      <div className="container-narrow text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="accent" className="mb-4">
            Free Trial
          </Badge>
        </motion.div>
        <motion.h1
          className="font-display text-display-lg text-primary mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Start your 30-day free trial
        </motion.h1>
        <motion.p
          className="text-lg text-secondary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          No credit card required. Full access to all features.
        </motion.p>
      </div>

      <div className="container-narrow">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Form */}
          <motion.div
            className="md:col-span-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="p-8">
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h2 className="font-display text-title text-primary mb-2">
                    You&apos;re all set
                  </h2>
                  <p className="text-secondary mb-6">
                    Check your email for login instructions. Your 30-day trial starts now.
                  </p>
                  <Button href="https://app.velocitypulse.io" variant="primary">
                    Go to Dashboard
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <Input
                      label="First name"
                      name="firstName"
                      placeholder="John"
                      required
                    />
                    <Input
                      label="Last name"
                      name="lastName"
                      placeholder="Smith"
                      required
                    />
                  </div>

                  <Input
                    label="Work email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                  />

                  <Input
                    label="Company name"
                    name="company"
                    placeholder="Acme Inc"
                    required
                  />

                  <div className="grid md:grid-cols-2 gap-6">
                    <Select
                      label="Company size"
                      name="companySize"
                      options={companySizeOptions}
                      placeholder="Select size"
                      required
                    />
                    <Select
                      label="Devices to monitor"
                      name="deviceCount"
                      options={deviceCountOptions}
                      placeholder="Select range"
                      required
                    />
                  </div>

                  <div className="pt-4">
                    <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
                      {isSubmitting ? 'Creating your account...' : 'Start Free Trial'}
                    </Button>
                  </div>

                  <p className="text-xs text-tertiary text-center">
                    By signing up, you agree to our{' '}
                    <a href="/legal/terms" className="text-accent hover:underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="/legal/privacy" className="text-accent hover:underline">
                      Privacy Policy
                    </a>
                    .
                  </p>
                </form>
              )}
            </Card>
          </motion.div>

          {/* Benefits sidebar */}
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="p-6">
              <h3 className="font-display text-title text-primary mb-6">
                What&apos;s included
              </h3>
              <ul className="space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit.text} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                      <benefit.icon className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <span className="text-secondary">{benefit.text}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 pt-6 border-t border-[var(--color-border-light)]">
                <p className="text-sm text-tertiary mb-4">
                  &quot;VelocityPulse is the simplest monitoring tool we&apos;ve ever used.
                  Set up took less than 10 minutes.&quot;
                </p>
                <p className="text-sm font-medium text-primary">
                  IT Manager, UK School
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
