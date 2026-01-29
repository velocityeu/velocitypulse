'use client'

import { motion } from 'framer-motion'
import {
  Search,
  Activity,
  Zap,
  Globe,
  Bell,
  Code,
  Shield,
  BarChart3,
  Clock,
  Users,
  Server,
  Wifi
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

const features = [
  {
    icon: Search,
    title: 'Auto-Discovery',
    description: 'VelocityPulse discovers every device the moment you install our agent. Servers, switches, printers, phones - if it\'s on your network, we\'ll find it.',
    details: [
      'ARP scanning for complete network visibility',
      'Automatic device classification',
      'New device notifications',
      'Network topology mapping',
    ],
  },
  {
    icon: Activity,
    title: 'Real-Time Monitoring',
    description: 'Live updates, not yesterday\'s news. See changes as they happen with sub-second refresh rates and real-time dashboards.',
    details: [
      'Sub-second status updates',
      'Live connection tracking',
      'Real-time performance metrics',
      'Instant incident detection',
    ],
  },
  {
    icon: Zap,
    title: 'Zero Configuration',
    description: '10 minutes to monitoring. Sign up, install agent, done. No config files. No consultants. No complexity.',
    details: [
      'One-line agent installation',
      'Automatic network detection',
      'Pre-configured dashboards',
      'No manual device setup',
    ],
  },
  {
    icon: Globe,
    title: 'Multi-Site Support',
    description: 'One dashboard for everywhere. Monitor all your locations from a single view with site-based filtering and grouping.',
    details: [
      'Unlimited sites per account',
      'Site-based device grouping',
      'Cross-site comparisons',
      'Centralized alerting',
    ],
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description: 'Alerts that matter, not noise. Smart notifications for real problems via email, Slack, Microsoft Teams, or webhooks.',
    details: [
      'Configurable alert thresholds',
      'Alert escalation rules',
      'Maintenance windows',
      'Alert suppression',
    ],
  },
  {
    icon: Code,
    title: 'Full API Access',
    description: 'Build integrations your way. RESTful API with webhooks for custom workflows, automation, and third-party integrations.',
    details: [
      'RESTful JSON API',
      'Webhook notifications',
      'API key management',
      'Rate limiting included',
    ],
  },
  {
    icon: Shield,
    title: 'Secure by Design',
    description: 'Your data is protected. TLS encryption, secure agent communication, and optional SSO with SAML 2.0 support.',
    details: [
      'TLS 1.3 encryption',
      'SSO (SAML 2.0) support',
      'API key authentication',
      'Audit logging',
    ],
  },
  {
    icon: BarChart3,
    title: 'Historical Analytics',
    description: 'Track trends over time with 1 year of data retention. Identify patterns and plan capacity with confidence.',
    details: [
      '1 year data retention',
      'Trend analysis',
      'Capacity planning reports',
      'Exportable data',
    ],
  },
  {
    icon: Clock,
    title: 'Uptime Tracking',
    description: 'Know exactly when devices go up and down. Track availability over time with detailed uptime reports.',
    details: [
      'Per-device uptime history',
      'SLA reporting',
      'Downtime notifications',
      'Availability dashboards',
    ],
  },
  {
    icon: Users,
    title: 'Unlimited Users',
    description: 'No per-seat licensing. Invite your entire team without worrying about costs or license management.',
    details: [
      'Unlimited team members',
      'Role-based access control',
      'Team activity logs',
      'User management',
    ],
  },
  {
    icon: Server,
    title: 'Device Details',
    description: 'Deep visibility into every monitored device. See status, history, alerts, and configuration at a glance.',
    details: [
      'Device status history',
      'Performance metrics',
      'Alert history',
      'Custom metadata',
    ],
  },
  {
    icon: Wifi,
    title: 'Network Health',
    description: 'Get a bird\'s-eye view of your network health with summary dashboards and status overviews.',
    details: [
      'Network status summary',
      'Health score indicators',
      'Quick status overview',
      'Problem highlighting',
    ],
  },
]

export default function FeaturesPage() {
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
          Everything you need to monitor your network
        </motion.h1>
        <motion.p
          className="text-lg text-secondary max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Professional-grade features at a price that makes sense.
          All features included in every plan - no upsells, no surprises.
        </motion.p>
      </div>

      {/* Features Grid */}
      <div className="container-wide mb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
            >
              <Card className="p-6 h-full">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-display text-title text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-secondary mb-4">
                  {feature.description}
                </p>
                <ul className="space-y-2">
                  {feature.details.map((detail) => (
                    <li key={detail} className="text-sm text-tertiary flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[var(--color-accent)]" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>
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
            Ready to get started?
          </h2>
          <p className="text-lg text-secondary mb-8 max-w-xl mx-auto">
            Try all features free for 30 days. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="/demo" size="lg">
              Start Free Trial
            </Button>
            <Button href="/pricing" variant="secondary" size="lg">
              See Pricing
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
