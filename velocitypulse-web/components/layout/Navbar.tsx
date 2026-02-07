'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import ThemeToggle from '../ui/ThemeToggle'
import Button from '../ui/Button'
import { useTheme } from '../ThemeProvider'

const navigation = [
  { name: 'Features', href: '/features' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Blog', href: '/blog' },
  { name: 'Partners', href: '/partners' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
]

// Dashboard URL - where authenticated users are redirected
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://app.velocitypulse.io'

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { resolvedTheme, mounted } = useTheme()
  const menuPanelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const openButtonRef = useRef<HTMLButtonElement>(null)

  // Close menu with Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isMenuOpen) {
      setIsMenuOpen(false)
      openButtonRef.current?.focus()
    }
  }, [isMenuOpen])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
      // Focus close button when menu opens
      closeButtonRef.current?.focus()
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  // Add keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // Focus trap within mobile menu
  const handleTabKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !menuPanelRef.current) return

    const focusableElements = menuPanelRef.current.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault()
      lastElement?.focus()
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault()
      firstElement?.focus()
    }
  }, [])

  return (
    <>
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-4 focus:py-2 focus:bg-[var(--color-accent)] focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      <nav className="sticky top-0 z-50 border-b border-[var(--color-border-light)] bg-[var(--color-bg)]/80 backdrop-blur-xl">
        <div className="container-wide">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Image
                src={mounted && resolvedTheme === 'dark' ? '/symbol-white.png' : '/symbol.png'}
                alt="VelocityPulse.io"
                width={32}
                height={32}
                className="h-8 w-8"
                priority
              />
              <span className="font-display font-semibold text-lg text-primary">
                VelocityPulse.io
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1" role="navigation" aria-label="Main navigation">
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
              <Link
                href={`${DASHBOARD_URL}/sign-in`}
                className="hidden md:inline-flex px-3 py-2 text-sm text-secondary hover:text-primary transition-colors"
              >
                Sign In
              </Link>
              <Button href={`${DASHBOARD_URL}/sign-up`} target="_self" className="hidden md:inline-flex">
                Start Free Trial
              </Button>

              {/* Mobile menu button */}
              <button
                ref={openButtonRef}
                className="md:hidden p-2 text-secondary hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isMenuOpen}
                aria-controls="mobile-menu"
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
          id="mobile-menu"
          className="fixed inset-0 md:hidden"
          style={{ zIndex: 9999 }}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onKeyDown={handleTabKey}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-in panel */}
          <div
            ref={menuPanelRef}
            className="absolute top-0 right-0 h-full w-80 max-w-[85vw] overflow-y-auto shadow-2xl"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderLeft: '1px solid var(--color-border)'
            }}
          >
            {/* Close button */}
            <div className="flex justify-end p-4">
              <button
                ref={closeButtonRef}
                onClick={() => {
                  setIsMenuOpen(false)
                  openButtonRef.current?.focus()
                }}
                className="p-2 text-secondary hover:text-primary rounded-lg"
                aria-label="Close navigation menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Menu content */}
            <nav className="px-4 pb-8" role="navigation" aria-label="Mobile navigation">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block px-4 py-3 text-sm text-secondary hover:text-primary hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
                  onClick={() => {
                    setIsMenuOpen(false)
                    openButtonRef.current?.focus()
                  }}
                >
                  {item.name}
                </Link>
              ))}

              <div className="mt-6 space-y-3 px-4">
                <Link
                  href={`${DASHBOARD_URL}/sign-in`}
                  className="block w-full px-4 py-3 text-center text-sm text-secondary hover:text-primary border border-[var(--color-border)] rounded-lg transition-colors"
                  onClick={() => {
                    setIsMenuOpen(false)
                    openButtonRef.current?.focus()
                  }}
                >
                  Sign In
                </Link>
                <Button
                  href={`${DASHBOARD_URL}/sign-up`}
                  target="_self"
                  className="w-full justify-center"
                  onClick={() => {
                    setIsMenuOpen(false)
                    openButtonRef.current?.focus()
                  }}
                >
                  Start Free Trial
                </Button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
