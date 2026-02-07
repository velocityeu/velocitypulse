const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['velocitypulse.io'],
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: !process.env.SENTRY_AUTH_TOKEN,
})
