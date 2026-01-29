'use client'

import { motion } from 'framer-motion'
import { Target, Heart, Zap } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

const values = [
  {
    icon: Target,
    title: 'Simplicity',
    description: 'Network monitoring shouldn\'t require a PhD. We build tools that work out of the box, so you can focus on what matters.',
  },
  {
    icon: Heart,
    title: 'Honesty',
    description: 'Transparent pricing, clear features, no hidden costs. What you see is what you get - always.',
  },
  {
    icon: Zap,
    title: 'Accessibility',
    description: 'Professional tools shouldn\'t have professional price tags. Great monitoring should be available to everyone.',
  },
]

export default function AboutPage() {
  return (
    <div className="py-16 md:py-24">
      {/* Header */}
      <div className="container-narrow text-center mb-16">
        <motion.h1
          className="font-display text-display-lg text-primary mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          About VelocityPulse
        </motion.h1>
        <motion.p
          className="text-lg text-secondary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Professional network monitoring from $50/year
        </motion.p>
      </div>

      {/* Story Section */}
      <div className="container-narrow mb-24">
        <motion.div
          className="prose prose-lg max-w-none"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 md:p-12">
            <h2 className="font-display text-display text-primary mb-6">Our Story</h2>
            <div className="space-y-4 text-secondary">
              <p>
                We started VelocityPulse because we were tired of the status quo in network monitoring.
                Every tool we tried was either too expensive, too complex, or both.
              </p>
              <p>
                Enterprise monitoring tools wanted thousands per year. Free tools required weeks of
                configuration. There was nothing in between - no simple, affordable option for small
                businesses, schools, and IT professionals who just wanted to keep an eye on their network.
              </p>
              <p>
                So we built VelocityPulse. Professional-grade monitoring that starts at $50/year.
                Real features, real support, real simplicity - without the enterprise price tag.
              </p>
              <p>
                Our goal is simple: make network monitoring accessible to everyone. Whether you&apos;re
                running a home lab, managing a small business, or overseeing multiple school sites,
                you deserve tools that work without breaking the bank.
              </p>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Values Section */}
      <div className="container-wide mb-24">
        <motion.h2
          className="font-display text-display text-primary text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          What we believe
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-8">
          {values.map((value, index) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="p-6 h-full text-center">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-display text-title text-primary mb-2">
                  {value.title}
                </h3>
                <p className="text-secondary">
                  {value.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Company Info */}
      <div className="container-narrow mb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 md:p-12">
            <h2 className="font-display text-display text-primary mb-6">Company Information</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-primary mb-2">Velocity EU Ltd</h3>
                <p className="text-secondary">
                  VelocityPulse is a product of Velocity EU Ltd, a technology company focused on
                  building practical tools for IT professionals.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-2">Contact</h3>
                <p className="text-secondary">
                  Have questions? We&apos;d love to hear from you.
                </p>
                <Button href="/contact" variant="ghost" className="mt-2 -ml-2">
                  Get in touch
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* CTA Section */}
      <div className="container-narrow">
        <motion.div
          className="card p-8 md:p-12 text-center bg-gradient-to-br from-[var(--color-accent)]/5 to-transparent"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-display text-display text-primary mb-4">
            Ready to try VelocityPulse?
          </h2>
          <p className="text-lg text-secondary mb-8 max-w-xl mx-auto">
            Start your free 30-day trial today. No credit card required.
          </p>
          <Button href="/demo" size="lg">
            Start Free Trial
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
