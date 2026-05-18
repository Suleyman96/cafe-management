'use client';

// Forwarding component instead of a pure re-export. Next.js's dev
// compiler tree-shakes bare `export { default } from '...'` modules
// and never emits a `chunks/.../error.js` file — but the route's
// runtime manifest still references the chunk URL, so the browser
// 404s on it. The error boundary then can't mount and the parent
// route hangs on its loading spinner until a hard refresh forces a
// full chunk-graph rebuild. Wrapping PageError in a real component
// gives the compiler an executable module to emit as its own chunk.

import PageError from '@/components/ui/page-error';

export default function RouteError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError {...props} />;
}
