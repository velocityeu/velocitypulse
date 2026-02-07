'use client'

import { motion } from 'framer-motion'
import Button from '../ui/Button'
import Badge from '../ui/Badge'

export default function Hero() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32 lg:py-40">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg-secondary)] to-transparent opacity-50" />

      <div className="container-wide relative">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <Badge variant="accent" className="mb-6">
              Network Monitoring
            </Badge>
          </motion.div>

          <motion.h1
            className="font-display text-display-lg md:text-display-xl text-primary mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          >
            From $50/year.{' '}
            <span className="text-accent">Yes, really.</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-secondary mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            Professional network monitoring without the professional price tag.
            Start at $50/year for up to 100 devices. Scale to $950/year for unlimited.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <Button href="https://app.velocitypulse.io/sign-up" size="lg" target="_self">
              Start 30-Day Trial
            </Button>
            <Button href="/pricing" variant="secondary" size="lg">
              See Pricing
            </Button>
          </motion.div>

          <motion.p
            className="mt-6 text-sm text-tertiary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            No credit card required. Full access for 30 days.
          </motion.p>
        </div>
      </div>
    </section>
  )
}
