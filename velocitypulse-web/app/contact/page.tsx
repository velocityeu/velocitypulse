'use client'

import { motion } from 'framer-motion'
import { Mail, MessageSquare, Clock, AlertCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import { useFormSubmit } from '@/hooks/useFormSubmit'

const subjectOptions = [
  { value: 'sales', label: 'Sales inquiry' },
  { value: 'support', label: 'Technical support' },
  { value: 'billing', label: 'Billing question' },
  { value: 'partnership', label: 'Partnership opportunity' },
  { value: 'other', label: 'Other' },
]

export default function ContactPage() {
  const { isSubmitting, isSubmitted, error, fieldErrors, handleSubmit, reset } = useFormSubmit({
    url: '/api/contact',
  })

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
          Get in touch
        </motion.h1>
        <motion.p
          className="text-lg text-secondary"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Have a question or need help? We&apos;re here to assist you.
        </motion.p>
      </div>

      <div className="container-narrow">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {[
            {
              icon: Mail,
              title: 'Email',
              description: 'support@velocitypulse.io',
            },
            {
              icon: MessageSquare,
              title: 'Sales',
              description: 'sales@velocitypulse.io',
            },
            {
              icon: Clock,
              title: 'Response Time',
              description: 'Within 24-48 hours',
            },
          ].map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="p-6 text-center h-full">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-primary mb-1">{item.title}</h3>
                <p className="text-secondary text-sm">{item.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="p-8 md:p-12">
            {isSubmitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="font-display text-title text-primary mb-2">
                  Message sent
                </h2>
                <p className="text-secondary mb-6">
                  Thank you for reaching out. We&apos;ll get back to you within 24-48 hours.
                </p>
                <Button onClick={reset} variant="secondary">
                  Send another message
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
                    label="Name"
                    name="name"
                    placeholder="Your name"
                    required
                    aria-required="true"
                    error={fieldErrors?.name}
                  />
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    aria-required="true"
                    error={fieldErrors?.email}
                  />
                </div>

                <Input
                  label="Organization"
                  name="organization"
                  placeholder="Your company or organization (optional)"
                  error={fieldErrors?.organization}
                />

                <Select
                  label="Subject"
                  name="subject"
                  options={subjectOptions}
                  placeholder="Select a subject"
                  required
                  aria-required="true"
                  error={fieldErrors?.subject}
                />

                <Textarea
                  label="Message"
                  name="message"
                  placeholder="How can we help you?"
                  required
                  aria-required="true"
                  error={fieldErrors?.message}
                />

                <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
