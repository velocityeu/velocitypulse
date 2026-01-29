'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ArrowRight, HelpCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { createCheckoutSession } from '@/lib/stripe'

type PlanId = 'trial' | 'starter' | 'unlimited'

const plans: Array<{
  id: PlanId
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  href?: string
  popular?: boolean
  variant: 'primary' | 'secondary'
}> = [
  {
    id: 'trial',
    name: 'Trial',
    price: 'Free',
    period: '30 days',
    description: 'Full access to test everything',
    features: [
      'Unlimited devices',
      'Unlimited agents',
      'Unlimited users',
      'All features included',
      'No credit card required',
    ],
    cta: 'Start Free Trial',
    href: '/demo',
    variant: 'secondary',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$50',
    period: '/year',
    description: 'For small businesses and home labs',
    features: [
      'Up to 100 devices',
      'Unlimited agents',
      'Unlimited users',
      '1 year data retention',
      'All features included',
      'Email, Slack, Teams alerts',
      'Full API access',
      'Email support (48h)',
    ],
    cta: 'Buy Now',
    variant: 'secondary',
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: '$950',
    period: '/year',
    description: 'For growing organizations',
    features: [
      'Up to 5,000 devices',
      'Unlimited agents',
      'Unlimited users',
      '1 year data retention',
      'All features included',
      'SSO (SAML) included',
      'White-label option',
      'Priority support (24h)',
      'Dedicated onboarding call',
    ],
    cta: 'Buy Now',
    popular: true,
    variant: 'primary',
  },
]

const comparisonFeatures = [
  { name: 'Devices', starter: 'Up to 100', unlimited: 'Up to 5,000' },
  { name: 'Agents', starter: 'Unlimited', unlimited: 'Unlimited' },
  { name: 'Users', starter: 'Unlimited', unlimited: 'Unlimited' },
  { name: 'Data retention', starter: '1 year', unlimited: '1 year' },
  { name: 'Auto-discovery', starter: true, unlimited: true },
  { name: 'Real-time monitoring', starter: true, unlimited: true },
  { name: 'Email alerts', starter: true, unlimited: true },
  { name: 'Slack/Teams alerts', starter: true, unlimited: true },
  { name: 'API access', starter: true, unlimited: true },
  { name: 'Multi-site support', starter: true, unlimited: true },
  { name: 'SSO (SAML)', starter: false, unlimited: true },
  { name: 'White-label option', starter: false, unlimited: true },
  { name: 'Support response', starter: '48 hours', unlimited: '24 hours' },
  { name: 'Onboarding call', starter: false, unlimited: true },
]

const faqs = [
  {
    question: 'What counts as a "device"?',
    answer: 'Any monitored endpoint: servers, switches, routers, printers, IoT devices, VMs. If our agent can discover it and you want to monitor it, it\'s a device.',
  },
  {
    question: 'What if I have more than 100 devices?',
    answer: 'You\'ll need the Unlimited tier at $950/year. Or remove a few devices and stay on Starter. Either way, it\'s affordable.',
  },
  {
    question: 'What happens at 5,000 devices?',
    answer: 'Contact us and we\'ll unlock higher limits for free if your use case is legitimate. The cap exists to prevent abuse, not to limit genuine customers.',
  },
  {
    question: 'Why annual billing only?',
    answer: 'At $50/year, monthly billing would be $4.17/month - not worth the overhead. Annual keeps it simple and reduces churn.',
  },
  {
    question: 'Do you offer education/non-profit discounts?',
    answer: 'No longer needed. At $50/year Starter and $950/year Unlimited, we\'re already affordable for everyone.',
  },
  {
    question: 'Is there a contract?',
    answer: 'No contracts. Annual billing is pre-paid, cancel anytime with access until the end of your paid period.',
  },
]

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null)

  const handleCheckout = async (planId: 'starter' | 'unlimited') => {
    setLoadingPlan(planId)
    try {
      const { url } = await createCheckoutSession({
        plan: planId,
        successUrl: `${window.location.origin}/checkout/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      })
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setLoadingPlan(null)
    }
  }

  return (
    <div className="py-16 md:py-24">
      {/* Header */}
      <div className="container-wide text-center mb-16">
        <motion.h1
          className="font-display text-display-lg text-primary mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Simple, predictable pricing
        </motion.h1>
        <motion.p
          className="text-lg text-secondary max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          No per-device fees. No surprises. Just straightforward annual pricing
          that works for businesses of all sizes.
        </motion.p>
      </div>

      {/* Pricing Cards */}
      <div className="container-wide mb-24">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              className={`card p-8 ${plan.popular ? 'ring-2 ring-[var(--color-accent)]' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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

              {plan.id === 'trial' ? (
                <Button
                  href={plan.href}
                  variant={plan.variant}
                  className="w-full justify-center"
                >
                  {plan.cta}
                </Button>
              ) : (
                <Button
                  variant={plan.variant}
                  className="w-full justify-center"
                  onClick={() => handleCheckout(plan.id as 'starter' | 'unlimited')}
                  disabled={loadingPlan === plan.id}
                >
                  {loadingPlan === plan.id ? 'Loading...' : plan.cta}
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="container-wide mb-24">
        <motion.h2
          className="font-display text-display text-primary text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Feature comparison
        </motion.h2>

        <motion.div
          className="card overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left p-4 font-semibold text-primary">Feature</th>
                  <th className="text-center p-4 font-semibold text-primary">Starter ($50/yr)</th>
                  <th className="text-center p-4 font-semibold text-primary bg-[var(--color-accent)]/5">Unlimited ($950/yr)</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature) => (
                  <tr key={feature.name} className="border-b border-[var(--color-border-light)]">
                    <td className="p-4 text-secondary">{feature.name}</td>
                    <td className="p-4 text-center">
                      {typeof feature.starter === 'boolean' ? (
                        feature.starter ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-tertiary">-</span>
                        )
                      ) : (
                        <span className="text-secondary">{feature.starter}</span>
                      )}
                    </td>
                    <td className="p-4 text-center bg-[var(--color-accent)]/5">
                      {typeof feature.unlimited === 'boolean' ? (
                        feature.unlimited ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-tertiary">-</span>
                        )
                      ) : (
                        <span className="text-secondary">{feature.unlimited}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Partner Section */}
      <div className="container-narrow mb-24">
        <motion.div
          className="card p-8 md:p-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="success" className="mb-4">
            Partner Program
          </Badge>
          <h2 className="font-display text-display text-primary mb-4">
            50% margin. Per customer. Simple.
          </h2>
          <p className="text-lg text-secondary mb-6 max-w-xl mx-auto">
            Resell VelocityPulse at full retail, pay us half.
            $25/customer/year (Starter) or $475/customer/year (Unlimited).
            No minimums. No negotiations.
          </p>
          <Button href="/partners">
            Become a Partner
            <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>

      {/* FAQ Section */}
      <div className="container-narrow">
        <motion.h2
          className="font-display text-display text-primary text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Frequently asked questions
        </motion.h2>

        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <motion.div
              key={faq.question}
              className="card p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
            >
              <div className="flex gap-4">
                <HelpCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-primary mb-2">{faq.question}</h3>
                  <p className="text-secondary">{faq.answer}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
