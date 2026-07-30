// Next.js instrumentation hook. Loads the runtime-appropriate Sentry config
// once per server boot (the canonical @sentry/nextjs wiring).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
