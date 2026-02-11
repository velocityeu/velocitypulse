import type { Metadata } from 'next'
import { Open_Sans, Poppins } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

const openSans = Open_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-open-sans',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://velocitypulse.io'),
  title: 'VelocityPulse.io | Professional Network Monitoring from \u00a350/year',
  description: 'Professional network monitoring without the professional price tag. Start at \u00a350/year for up to 100 devices. Scale to \u00a3950/year for larger organizations. No per-device pricing, no surprises.',
  keywords: ['network monitoring', 'infrastructure monitoring', 'IT dashboard', 'device monitoring', 'real-time alerts', 'affordable', 'VelocityPulse'],
  authors: [{ name: 'Velocity EU' }],
  icons: {
    icon: [
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
      { url: '/apple-icon-152x152.png', sizes: '152x152' },
      { url: '/apple-icon-120x120.png', sizes: '120x120' },
    ],
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'VelocityPulse.io | Professional Network Monitoring from \u00a350/year',
    description: 'Professional network monitoring without the professional price tag. Start at \u00a350/year for up to 100 devices.',
    url: 'https://velocitypulse.io',
    siteName: 'VelocityPulse.io',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VelocityPulse - Network Monitoring',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VelocityPulse.io | Professional Network Monitoring from \u00a350/year',
    description: 'Professional network monitoring without the professional price tag. Start at \u00a350/year for up to 100 devices.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${openSans.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans bg-primary min-h-screen flex flex-col">
        <ThemeProvider>
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
