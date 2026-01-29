'use client'

import { motion } from 'framer-motion'
import {
  Search,
  Activity,
  Zap,
  Globe,
  Bell,
  Code
} from 'lucide-react'
import Card from '../ui/Card'

const features = [
  {
    icon: Search,
    title: 'Auto-Discovery',
    description: 'Install our agent. Watch devices appear. Servers, switches, printers, phones - if it\'s on your network, we\'ll find it.',
  },
  {
    icon: Activity,
    title: 'Real-Time Monitoring',
    description: 'Live updates, not yesterday\'s news. See changes as they happen with sub-second refresh rates.',
  },
  {
    icon: Zap,
    title: 'Zero Configuration',
    description: '10 minutes to monitoring. Sign up, install agent, done. No config files. No consultants. No complexity.',
  },
  {
    icon: Globe,
    title: 'Multi-Site Support',
    description: 'One dashboard for everywhere. Monitor all your locations from a single view with site-based filtering.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description: 'Alerts that matter, not noise. Smart notifications for real problems via email, Slack, or Teams.',
  },
  {
    icon: Code,
    title: 'Full API Access',
    description: 'Build integrations your way. RESTful API with webhooks for custom workflows and automation.',
  },
]

export default function Features() {
  return (
    <section className="py-24 md:py-32 bg-secondary">
      <div className="container-wide">
        <div className="text-center mb-16">
          <motion.h2
            className="font-display text-display text-primary mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Everything you need, nothing you don't
          </motion.h2>
          <motion.p
            className="text-lg text-secondary max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Professional-grade features at a price that makes sense.
            All features included in every plan.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={feature.title} className="p-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-display text-title text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-secondary">
                  {feature.description}
                </p>
              </motion.div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
