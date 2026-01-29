'use client'

import { motion } from 'framer-motion'
import { Check, ArrowRight, Download, Mail } from 'lucide-react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const nextSteps = [
  { icon: Mail, text: 'Check your email for login credentials' },
  { icon: Download, text: 'Download the agent for your network' },
  { icon: Check, text: 'Start monitoring in minutes' },
]

export default function CheckoutSuccessPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="container-narrow">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-500" />
          </div>
          <Badge variant="success" className="mb-4">
            Payment Successful
          </Badge>
          <h1 className="font-display text-display-lg text-primary mb-4">
            Welcome to VelocityPulse
          </h1>
          <p className="text-lg text-secondary max-w-xl mx-auto">
            Your subscription is now active. We&apos;ve sent your account details
            and getting started guide to your email.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="p-8 mb-8">
            <h2 className="font-display text-title text-primary mb-6">
              Next steps
            </h2>
            <ul className="space-y-4 mb-8">
              {nextSteps.map((step, index) => (
                <li key={step.text} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-accent">{index + 1}</span>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <step.icon className="w-5 h-5 text-secondary" />
                    <span className="text-secondary">{step.text}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button href="https://app.velocitypulse.io" variant="primary">
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button href="/features" variant="secondary">
                Explore Features
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.p
          className="text-center text-sm text-tertiary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Need help getting started?{' '}
          <a href="/contact" className="text-accent hover:underline">
            Contact our support team
          </a>
        </motion.p>
      </div>
    </div>
  )
}
