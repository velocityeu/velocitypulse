export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getServerEnv, getClientEnv } = await import('./src/lib/env')
    getServerEnv()
    getClientEnv()
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const { getClientEnv } = await import('./src/lib/env')
    getClientEnv()
    await import('./sentry.edge.config')
  }
}
