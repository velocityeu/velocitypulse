'use client'

import { motion } from 'framer-motion'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function GDPRPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-display-lg text-primary mb-4 text-center">
            GDPR Information
          </h1>
          <p className="text-secondary text-center mb-12">
            Your rights under the General Data Protection Regulation
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="p-8 md:p-12">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <h2 className="font-display text-title text-primary">Our Commitment to GDPR</h2>
              <p className="text-secondary">
                VelocityPulse is committed to protecting your personal data in compliance with the
                General Data Protection Regulation (GDPR). This page explains how we comply with
                GDPR and outlines your rights.
              </p>

              <h2 className="font-display text-title text-primary mt-8">Data Controller</h2>
              <p className="text-secondary">
                Velocity EU Ltd is the data controller for personal data collected through VelocityPulse.
              </p>
              <p className="text-secondary mt-4">
                Contact: dpo@velocitypulse.io<br />
                Velocity EU Ltd<br />
                United Kingdom
              </p>

              <h2 className="font-display text-title text-primary mt-8">Legal Basis for Processing</h2>
              <p className="text-secondary">We process your personal data based on:</p>
              <ul className="text-secondary list-disc pl-6 space-y-2 mt-4">
                <li><strong>Contract:</strong> Processing necessary to provide VelocityPulse services</li>
                <li><strong>Legitimate Interest:</strong> Service improvement and fraud prevention</li>
                <li><strong>Consent:</strong> Marketing communications (where applicable)</li>
                <li><strong>Legal Obligation:</strong> Tax and accounting requirements</li>
              </ul>

              <h2 className="font-display text-title text-primary mt-8">Your Rights Under GDPR</h2>

              <h3 className="font-semibold text-primary mt-4">Right to Access</h3>
              <p className="text-secondary">
                You have the right to request a copy of the personal data we hold about you.
              </p>

              <h3 className="font-semibold text-primary mt-4">Right to Rectification</h3>
              <p className="text-secondary">
                You have the right to request correction of inaccurate or incomplete personal data.
              </p>

              <h3 className="font-semibold text-primary mt-4">Right to Erasure</h3>
              <p className="text-secondary">
                You have the right to request deletion of your personal data in certain circumstances.
              </p>

              <h3 className="font-semibold text-primary mt-4">Right to Restrict Processing</h3>
              <p className="text-secondary">
                You have the right to request restriction of processing of your personal data.
              </p>

              <h3 className="font-semibold text-primary mt-4">Right to Data Portability</h3>
              <p className="text-secondary">
                You have the right to receive your personal data in a structured, commonly used format.
              </p>

              <h3 className="font-semibold text-primary mt-4">Right to Object</h3>
              <p className="text-secondary">
                You have the right to object to processing of your personal data in certain circumstances.
              </p>

              <h3 className="font-semibold text-primary mt-4">Right to Withdraw Consent</h3>
              <p className="text-secondary">
                Where we rely on consent, you have the right to withdraw it at any time.
              </p>

              <h2 className="font-display text-title text-primary mt-8">Data Transfers</h2>
              <p className="text-secondary">
                Your data may be transferred to and processed in countries outside the EEA.
                We ensure appropriate safeguards are in place, including Standard Contractual Clauses.
              </p>

              <h2 className="font-display text-title text-primary mt-8">Data Retention</h2>
              <p className="text-secondary">
                We retain your personal data for as long as necessary to provide our services
                and comply with legal obligations. Network monitoring data is retained for 1 year.
                Account data is deleted within 30 days of account closure.
              </p>

              <h2 className="font-display text-title text-primary mt-8">Exercising Your Rights</h2>
              <p className="text-secondary">
                To exercise any of your GDPR rights, please contact us at:
              </p>
              <p className="text-secondary mt-4">
                Email: dpo@velocitypulse.io
              </p>
              <p className="text-secondary mt-4">
                We will respond to your request within 30 days. You also have the right to lodge
                a complaint with your local supervisory authority.
              </p>
            </div>
          </Card>
        </motion.div>

        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Button href="/contact" variant="secondary">
            Contact our Data Protection Officer
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
