import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'VelocityPulse Dashboard',
  description: 'Real-time IT infrastructure monitoring for small businesses',
  icons: {
    icon: '/favicon.ico',
  },
}

// Check if Clerk is configured with a valid key
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
const isClerkConfigured = clerkKey && clerkKey.startsWith('pk_') && !clerkKey.includes('placeholder')

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const body = (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  )

  // Only wrap with ClerkProvider if valid key is configured
  if (isClerkConfigured) {
    return <ClerkProvider>{body}</ClerkProvider>
  }

  return body
}
