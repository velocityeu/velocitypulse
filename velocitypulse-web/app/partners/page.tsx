'use client'

import { motion } from 'framer-motion'
import { Check, DollarSign, Users, Palette, ArrowRight, AlertCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useFormSubmit } from '@/hooks/useFormSubmit'

const benefits = [
  {
    icon: DollarSign,
    title: '50% Margin',
    description: 'Keep half of every sale. $25/customer (Starter) or $475/customer (Unlimited).',
  },
  {
    icon: Users,
    title: 'No Minimums',
    description: 'Start with one customer or one hundred. No volume requirements.',
  },
  {
    icon: Palette,
    title: 'White-Label Option',
    description: 'Rebrand VelocityPulse with your own logo and colors (Unlimited tier).',
  },
]

const partnerPricing = [
  {
    tier: 'Starter',
    retail: '$50/year',
    partner: '$25/year',
    features: ['Up to 100 devices', 'All features included', 'Email support'],
  },
  {
    tier: 'Unlimited',
    retail: '$950/year',
    partner: '$475/year',
    features: ['Up to 5,000 devices', 'SSO included', 'White-label available', 'Priority support'],
  },
]

const countryOptions = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'IE', label: 'Ireland' },
  { value: 'other', label: 'Other' },
]

const clientCountOptions = [
  { value: '1-5', label: '1-5 clients' },
  { value: '6-20', label: '6-20 clients' },
  { value: '21-50', label: '21-50 clients' },
  { value: '51-100', label: '51-100 clients' },
  { value: '100+', label: '100+ clients' },
]

const avgDevicesOptions = [
  { value: '1-25', label: '1-25 devices' },
  { value: '26-50', label: '26-50 devices' },
  { value: '51-100', label: '51-100 devices' },
  { value: '101-500', label: '101-500 devices' },
  { value: '500+', label: '500+ devices' },
]

const tierOptions = [
  { value: 'starter', label: 'Starter only' },
  { value: 'unlimited', label: 'Unlimited only' },
  { value: 'both', label: 'Both tiers' },
]

const whiteLabelOptions = [
  { value: 'yes', label: 'Yes, I want white-label' },
  { value: 'no', label: 'No, standard branding is fine' },
  { value: 'maybe', label: 'Maybe later' },
]

export default function PartnersPage() {
  const { isSubmitting, isSubmitted, error, fieldErrors, handleSubmit, reset } = useFormSubmit({
    url: '/api/partners',
  })

  return (
    <div className="py-16 md:py-24">
      {/* Header */}
      <div className="container-narrow text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="success" className="mb-4">
            Partner Program
          </Badge>
        </motion.div>
        <motion.h1
          className="font-display text-display-lg text-primary mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          50% margin. Per customer. Simple.
        </motion.h1>
        <motion.p
          className="text-lg text-secondary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Resell VelocityPulse at full retail, pay us half. No minimums, no negotiations.
        </motion.p>
      </div>

      {/* Benefits */}
      <div className="container-wide mb-24">
        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
            >
              <Card className="p-6 h-full text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="font-display text-title text-primary mb-2">
                  {benefit.title}
                </h3>
                <p className="text-secondary">{benefit.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Partner Pricing */}
      <div className="container-wide mb-24">
        <motion.h2
          className="font-display text-display text-primary text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Partner pricing
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {partnerPricing.map((plan, index) => (
            <motion.div
              key={plan.tier}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="p-8">
                <h3 className="font-display text-title text-primary mb-4">{plan.tier}</h3>
                <div className="flex items-baseline gap-4 mb-6">
                  <div>
                    <span className="text-sm text-tertiary line-through">{plan.retail}</span>
                    <span className="font-display text-display text-primary ml-2">{plan.partner}</span>
                  </div>
                  <Badge variant="success">50% off</Badge>
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Registration Form */}
      <div className="container-narrow" id="register">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 md:p-12">
            <h2 className="font-display text-display text-primary text-center mb-8">
              Become a Partner
            </h2>

            {isSubmitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="font-display text-title text-primary mb-2">
                  Application received
                </h3>
                <p className="text-secondary mb-6">
                  Thank you for your interest in the VelocityPulse Partner Program.
                  We&apos;ll review your application and get back to you within 2-3 business days.
                </p>
                <Button onClick={reset} variant="secondary">
                  Submit another application
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Error Banner */}
                {error && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <Input
                    label="Company name"
                    name="companyName"
                    placeholder="Acme IT Services"
                    required
                    aria-required="true"
                    error={fieldErrors?.companyName}
                  />
                  <Input
                    label="Website"
                    name="website"
                    type="url"
                    placeholder="https://example.com"
                    required
                    aria-required="true"
                    error={fieldErrors?.website}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Input
                    label="Contact name"
                    name="contactName"
                    placeholder="John Smith"
                    required
                    aria-required="true"
                    error={fieldErrors?.contactName}
                  />
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    required
                    aria-required="true"
                    error={fieldErrors?.email}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Input
                    label="Phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    required
                    aria-required="true"
                    error={fieldErrors?.phone}
                  />
                  <Select
                    label="Country"
                    name="country"
                    options={countryOptions}
                    placeholder="Select country"
                    required
                    aria-required="true"
                    error={fieldErrors?.country}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Select
                    label="Number of clients"
                    name="clientCount"
                    options={clientCountOptions}
                    placeholder="Select range"
                    required
                    aria-required="true"
                    error={fieldErrors?.clientCount}
                  />
                  <Select
                    label="Average devices per client"
                    name="avgDevices"
                    options={avgDevicesOptions}
                    placeholder="Select range"
                    required
                    aria-required="true"
                    error={fieldErrors?.avgDevices}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Select
                    label="Tier preference"
                    name="tierPreference"
                    options={tierOptions}
                    placeholder="Select tier"
                    required
                    aria-required="true"
                    error={fieldErrors?.tierPreference}
                  />
                  <Select
                    label="White-label interest"
                    name="whiteLabel"
                    options={whiteLabelOptions}
                    placeholder="Select option"
                    required
                    aria-required="true"
                    error={fieldErrors?.whiteLabel}
                  />
                </div>

                <Input
                  label="Tax ID / VAT number"
                  name="taxId"
                  placeholder="Optional - for invoicing"
                  error={fieldErrors?.taxId}
                />

                <Textarea
                  label="Tell us about your business"
                  name="businessDescription"
                  placeholder="What services do you offer? Who are your typical clients?"
                  error={fieldErrors?.businessDescription}
                />

                <div className="space-y-4 pt-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      name="termsAccepted"
                      required
                      aria-required="true"
                      className="mt-1 w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                    />
                    <span className="text-sm text-secondary">
                      I agree to the VelocityPulse{' '}
                      <a href="/legal/terms" className="text-accent hover:underline">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="/legal/privacy" className="text-accent hover:underline">
                        Privacy Policy
                      </a>
                      .
                    </span>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      name="gdprConsent"
                      required
                      aria-required="true"
                      className="mt-1 w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                    />
                    <span className="text-sm text-secondary">
                      I consent to VelocityPulse processing my data to evaluate my partner
                      application and contact me about the partnership opportunity.
                    </span>
                  </label>
                </div>

                <div className="pt-4">
                  <Button type="submit" disabled={isSubmitting} size="lg" className="w-full md:w-auto">
                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
