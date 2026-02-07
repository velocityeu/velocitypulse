'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  href?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'inverted'
  size?: 'sm' | 'default' | 'lg'
  className?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  target?: '_self' | '_blank'
}

export default function Button({
  children,
  href,
  variant = 'primary',
  size = 'default',
  className = '',
  onClick,
  disabled = false,
  type = 'button',
  target,
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] active:scale-[0.98]',
    secondary: 'bg-[var(--color-bg-secondary)] text-primary border border-[var(--color-border)] hover:border-[var(--color-accent)] active:scale-[0.98]',
    ghost: 'text-secondary hover:text-primary hover:bg-[var(--color-bg-secondary)]',
    inverted: 'bg-white text-[var(--color-accent)] hover:bg-gray-100 active:scale-[0.98]',
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    default: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`

  if (href) {
    return href.startsWith('#') || href.startsWith('/') ? (
      <Link href={href} className={classes}>{children}</Link>
    ) : (
      <a href={href} target={target || '_blank'} rel={target === '_self' ? undefined : 'noopener noreferrer'} className={classes}>{children}</a>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  )
}
