const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['velocitypulse.io'],
  },
  async redirects() {
    return [
      { source: '/demo', destination: 'https://app.velocitypulse.io/sign-up', permanent: true },
      { source: '/checkout/success', destination: 'https://app.velocitypulse.io/sign-up', permanent: true },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: !process.env.SENTRY_AUTH_TOKEN,
})
