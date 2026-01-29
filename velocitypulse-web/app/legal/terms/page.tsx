'use client'

import { motion } from 'framer-motion'
import Card from '@/components/ui/Card'

export default function TermsPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-display-lg text-primary mb-4 text-center">
            Terms of Service
          </h1>
          <p className="text-secondary text-center mb-12">
            Last updated: January 2026
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="p-8 md:p-12">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2 className="font-display text-title text-primary">1. Agreement to Terms</h2>
              <p className="text-secondary">
                By accessing or using VelocityPulse, you agree to be bound by these Terms of Service.
                If you do not agree to these terms, you may not use our service.
              </p>

              <h2 className="font-display text-title text-primary mt-8">2. Description of Service</h2>
              <p className="text-secondary">
                VelocityPulse is a network monitoring service that provides real-time visibility
                into your network infrastructure. Our service includes device discovery, status
                monitoring, alerting, and reporting features.
              </p>

              <h2 className="font-display text-title text-primary mt-8">3. Account Registration</h2>
              <p className="text-secondary">
                To use VelocityPulse, you must create an account and provide accurate, complete
                information. You are responsible for maintaining the security of your account
                credentials and for all activities that occur under your account.
              </p>

              <h2 className="font-display text-title text-primary mt-8">4. Subscription and Payment</h2>
              <h3 className="font-semibold text-primary mt-4">Pricing</h3>
              <p className="text-secondary">
                VelocityPulse offers two subscription tiers: Starter ($50/year) and Unlimited ($950/year).
                All subscriptions are billed annually in advance.
              </p>

              <h3 className="font-semibold text-primary mt-4">Free Trial</h3>
              <p className="text-secondary">
                We offer a 30-day free trial with full access to all features. No credit card is
                required to start a trial.
              </p>

              <h3 className="font-semibold text-primary mt-4">Refunds</h3>
              <p className="text-secondary">
                We offer a 30-day money-back guarantee from the date of purchase. Contact us within
                30 days of your purchase for a full refund.
              </p>

              <h2 className="font-display text-title text-primary mt-8">5. Fair Use Policy</h2>
              <p className="text-secondary">
                The Unlimited tier includes monitoring for up to 5,000 devices. This limit exists
                to prevent abuse. Customers with legitimate needs exceeding this limit may request
                an increase at no additional cost.
              </p>

              <h2 className="font-display text-title text-primary mt-8">6. Acceptable Use</h2>
              <p className="text-secondary">You agree not to:</p>
              <ul className="text-secondary list-disc pl-6 space-y-2 mt-4">
                <li>Use VelocityPulse for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt the service</li>
                <li>Resell access without participating in our Partner Program</li>
                <li>Use the service to monitor networks you don't own or have permission to monitor</li>
              </ul>

              <h2 className="font-display text-title text-primary mt-8">7. Intellectual Property</h2>
              <p className="text-secondary">
                VelocityPulse and its content, features, and functionality are owned by Velocity EU Ltd
                and are protected by copyright, trademark, and other intellectual property laws.
              </p>

              <h2 className="font-display text-title text-primary mt-8">8. Limitation of Liability</h2>
              <p className="text-secondary">
                To the maximum extent permitted by law, Velocity EU Ltd shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages, or any loss of
                profits or revenues, whether incurred directly or indirectly.
              </p>

              <h2 className="font-display text-title text-primary mt-8">9. Termination</h2>
              <p className="text-secondary">
                You may cancel your subscription at any time. Upon cancellation, you will retain
                access until the end of your current billing period. We reserve the right to
                terminate accounts that violate these terms.
              </p>

              <h2 className="font-display text-title text-primary mt-8">10. Changes to Terms</h2>
              <p className="text-secondary">
                We may update these terms from time to time. We will notify you of any material
                changes by email or through the service. Your continued use after changes
                constitutes acceptance of the new terms.
              </p>

              <h2 className="font-display text-title text-primary mt-8">11. Contact</h2>
              <p className="text-secondary">
                Questions about these Terms of Service should be sent to:
              </p>
              <p className="text-secondary mt-4">
                Email: legal@velocitypulse.io<br />
                Velocity EU Ltd<br />
                United Kingdom
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
