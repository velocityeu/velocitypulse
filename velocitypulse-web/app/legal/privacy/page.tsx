'use client'

import { motion } from 'framer-motion'
import Card from '@/components/ui/Card'

export default function PrivacyPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-display-lg text-primary mb-4 text-center">
            Privacy Policy
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
              <h2 className="font-display text-title text-primary">1. Introduction</h2>
              <p className="text-secondary">
                VelocityPulse (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your
                information when you use our network monitoring service.
              </p>

              <h2 className="font-display text-title text-primary mt-8">2. Information We Collect</h2>
              <h3 className="font-semibold text-primary mt-4">Account Information</h3>
              <p className="text-secondary">
                When you create an account, we collect your name, email address, company name,
                and billing information.
              </p>

              <h3 className="font-semibold text-primary mt-4">Usage Data</h3>
              <p className="text-secondary">
                We automatically collect information about how you use VelocityPulse, including
                device information, IP addresses, browser type, and pages visited.
              </p>

              <h3 className="font-semibold text-primary mt-4">Network Data</h3>
              <p className="text-secondary">
                Our agents collect network device information including device names, IP addresses,
                MAC addresses, and status information. This data is used solely to provide you
                with network monitoring services.
              </p>

              <h2 className="font-display text-title text-primary mt-8">3. How We Use Your Information</h2>
              <p className="text-secondary">We use the information we collect to:</p>
              <ul className="text-secondary list-disc pl-6 space-y-2 mt-4">
                <li>Provide, maintain, and improve VelocityPulse</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze usage patterns</li>
                <li>Detect and prevent fraud and abuse</li>
              </ul>

              <h2 className="font-display text-title text-primary mt-8">4. Data Retention</h2>
              <p className="text-secondary">
                We retain your network monitoring data for 1 year. Account information is retained
                for as long as your account is active. When you delete your account, we delete your
                data within 30 days.
              </p>

              <h2 className="font-display text-title text-primary mt-8">5. Data Security</h2>
              <p className="text-secondary">
                We implement appropriate technical and organizational measures to protect your data,
                including encryption in transit (TLS 1.3), encryption at rest, and access controls.
              </p>

              <h2 className="font-display text-title text-primary mt-8">6. Third-Party Services</h2>
              <p className="text-secondary">We use the following third-party services:</p>
              <ul className="text-secondary list-disc pl-6 space-y-2 mt-4">
                <li>Stripe for payment processing</li>
                <li>Zoho for customer support</li>
                <li>Cloud hosting providers for infrastructure</li>
              </ul>

              <h2 className="font-display text-title text-primary mt-8">7. Your Rights</h2>
              <p className="text-secondary">You have the right to:</p>
              <ul className="text-secondary list-disc pl-6 space-y-2 mt-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
                <li>Withdraw consent at any time</li>
              </ul>

              <h2 className="font-display text-title text-primary mt-8">8. Contact Us</h2>
              <p className="text-secondary">
                If you have questions about this Privacy Policy, please contact us at:
              </p>
              <p className="text-secondary mt-4">
                Email: privacy@velocitypulse.io<br />
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
