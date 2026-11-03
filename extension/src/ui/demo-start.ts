import { startDemo } from './client'

/**
 * `?demo` in a development or e2e build answers every screen from saved fixtures, for
 * screenshots and the smoke test. A release build drops this branch and the fixtures with it.
 */
export async function startDemoIfAsked(): Promise<void> {
  if (import.meta.env.MODE === 'production') return
  if (!new URLSearchParams(location.search).has('demo')) return
  const { demo } = await import('../demo/demo')
  startDemo(demo)
}
