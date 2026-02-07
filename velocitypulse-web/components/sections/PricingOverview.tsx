'use client'

import { motion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import Button from '../ui/Button'
import Badge from '../ui/Badge'

const plans = [
  {
    name: 'Starter',
    price: '$50',
    period: '/year',
    description: 'Perfect for small businesses, home labs, and single sites',
    features: [
      'Up to 100 devices',
      'Unlimited agents',
      'Unlimited users',
      'All features included',
      'Email support (48h)',
    ],
    cta: 'Start Free Trial',
    href: 'https://app.velocitypulse.io/sign-up?plan=starter',
    popular: false,
  },
  {
    name: 'Unlimited',
    price: '$950',
    period: '/year',
    description: 'For growing organizations that need to scale',
    features: [
      'Up to 5,000 devices',
      'Unlimited agents',
      'Unlimited users',
      'SSO (SAML) included',
      'Priority support (24h)',
      'Dedicated onboarding',
    ],
    cta: 'Start Free Trial',
    href: 'https://app.velocitypulse.io/sign-up?plan=unlimited',
    popular: true,
  },
]

export default function PricingOverview() {
  return (
    <section className="py-24 md:py-32">
      <div className="container-wide">
        <div className="text-center mb-16">
          <motion.h2
            className="font-display text-display text-primary mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Simple, predictable pricing
          </motion.h2>
          <motion.p
            className="text-lg text-secondary max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            No per-device fees. No surprises. Just straightforward annual pricing.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              className={`card p-8 ${plan.popular ? 'ring-2 ring-[var(--color-accent)]' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {plan.popular && (
                <Badge variant="accent" className="mb-4">
                  Most Popular
                </Badge>
              )}
              <h3 className="font-display text-title text-primary mb-2">
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="font-display text-display text-primary">{plan.price}</span>
                <span className="text-secondary">{plan.period}</span>
              </div>
              <p className="text-secondary mb-6">{plan.description}</p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                href={plan.href}
                target="_self"
                variant={plan.popular ? 'primary' : 'secondary'}
                className="w-full justify-center"
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-secondary mb-4">
            Are you an MSP or reseller?
          </p>
          <Button href="/partners" variant="ghost">
            Learn about our Partner Program
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
