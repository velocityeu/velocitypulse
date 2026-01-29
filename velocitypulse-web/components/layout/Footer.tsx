'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '../ThemeProvider'

const footerLinks = {
  Product: [
    { name: 'Features', href: '/features' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Partners', href: '/partners' },
    { name: 'Demo', href: '/demo' },
  ],
  Company: [
    { name: 'About Us', href: '/about' },
    { name: 'Contact', href: '/contact' },
    { name: 'Blog', href: '/blog' },
  ],
  Resources: [
    { name: 'Documentation', href: 'https://docs.velocitypulse.io' },
    { name: 'API Reference', href: 'https://docs.velocitypulse.io/api' },
    { name: 'Status', href: 'https://status.velocitypulse.io' },
    { name: 'Support', href: '/contact' },
  ],
  Legal: [
    { name: 'Privacy Policy', href: '/legal/privacy' },
    { name: 'Terms of Service', href: '/legal/terms' },
    { name: 'GDPR', href: '/legal/gdpr' },
  ],
}

interface AccordionSectionProps {
  title: string
  links: { name: string; href: string }[]
}

function AccordionSection({ title, links }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-[var(--color-border-light)] md:border-none">
      {/* Mobile: Accordion header */}
      <button
        className="flex w-full items-center justify-between py-4 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <h3 className="font-semibold text-sm text-primary uppercase tracking-wider">
          {title}
        </h3>
        <ChevronDown
          className={`w-5 h-5 text-tertiary transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Desktop: Static header */}
      <h3 className="hidden md:block font-semibold text-sm text-primary mb-4">
        {title}
      </h3>

      {/* Links - collapsible on mobile, always visible on desktop */}
      <ul
        className={`space-y-3 overflow-hidden transition-all duration-300 md:!max-h-none md:!opacity-100 md:!pb-0 ${
          isOpen ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'
        }`}
      >
        {links.map((link) => (
          <li key={link.name}>
            <Link
              href={link.href}
              className="text-sm text-secondary hover:text-primary transition-colors"
            >
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Footer() {
  const { resolvedTheme, mounted } = useTheme()

  return (
    <footer className="border-t border-[var(--color-border-light)] bg-secondary">
      <div className="container-wide py-8 md:py-16">
        {/* Main footer grid */}
        <div className="md:grid md:grid-cols-5 md:gap-8">
          {/* Brand column - always visible */}
          <div className="pb-6 mb-6 border-b border-[var(--color-border-light)] md:border-none md:pb-0 md:mb-0">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src={mounted && resolvedTheme === 'dark' ? '/logo-white.png' : '/logo.svg'}
                alt="VelocityPulse"
                width={120}
                height={35}
                className="h-8 w-auto"
              />
            </Link>
            <p className="mt-4 text-sm text-secondary leading-relaxed">
              Professional network monitoring from $50/year. Your network&apos;s heartbeat, at a glance.
            </p>
          </div>

          {/* Link columns - accordion on mobile */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <AccordionSection key={category} title={category} links={links} />
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-8 border-t border-[var(--color-border-light)]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-tertiary">
              <span>2026 Velocity EU Ltd. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-tertiary">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
