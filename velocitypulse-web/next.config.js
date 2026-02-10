// @ts-check
const { withSentryConfig } = require('@sentry/nextjs')
const { execSync } = require('child_process')
const pkg = require('./package.json')

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  (() => {
    try {
      return execSync('git rev-parse --short HEAD').toString().trim()
    } catch {
      return 'dev'
    }
  })()

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
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
