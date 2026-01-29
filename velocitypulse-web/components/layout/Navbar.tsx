'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import ThemeToggle from '../ui/ThemeToggle'
import Button from '../ui/Button'
import { useTheme } from '../ThemeProvider'

const navigation = [
  { name: 'Features', href: '/features' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Partners', href: '/partners' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
]

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { resolvedTheme, mounted } = useTheme()

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[var(--color-border-light)] bg-[var(--color-bg)]/80 backdrop-blur-xl">
        <div className="container-wide">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Image
                src={mounted && resolvedTheme === 'dark' ? '/logo-white.png' : '/logo.svg'}
                alt="VelocityPulse"
                width={120}
                height={35}
                className="h-8 w-auto"
                priority
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button href="/demo" className="hidden md:inline-flex">
                Start Free Trial
              </Button>

              {/* Mobile menu button */}
              <button
                className="md:hidden p-2 text-secondary hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu - Full screen overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 md:hidden"
          style={{ zIndex: 9999 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Slide-in panel */}
          <div
            className="absolute top-0 right-0 h-full w-80 max-w-[85vw] overflow-y-auto shadow-2xl"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderLeft: '1px solid var(--color-border)'
            }}
          >
            {/* Close button */}
            <div className="flex justify-end p-4">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 text-secondary hover:text-primary rounded-lg"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Menu content */}
            <div className="px-4 pb-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block px-4 py-3 text-sm text-secondary hover:text-primary hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}

              <div className="mt-6 px-4">
                <Button href="/demo" className="w-full justify-center" onClick={() => setIsMenuOpen(false)}>
                  Start Free Trial
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
