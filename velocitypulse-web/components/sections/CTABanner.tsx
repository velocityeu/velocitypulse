'use client'

import { motion } from 'framer-motion'
import Button from '../ui/Button'

export default function CTABanner() {
  return (
    <section className="py-24 md:py-32 bg-secondary">
      <div className="container-narrow">
        <motion.div
          className="card p-8 md:p-12 text-center bg-gradient-to-br from-[var(--color-accent)]/5 to-transparent"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-display text-display text-primary mb-4">
            Try professional monitoring free for 30 days
          </h2>
          <p className="text-lg text-secondary mb-8 max-w-xl mx-auto">
            Full access. No credit card. No commitment.
            Then $50/year for Starter or $950/year for Unlimited.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="https://app.velocitypulse.io/sign-up" size="lg" target="_self">
              Start Your Trial
            </Button>
            <Button href="/contact" variant="secondary" size="lg">
              Contact Sales
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
