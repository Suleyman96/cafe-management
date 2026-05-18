'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  // C5: `lang="en"` matches the strings rendered below. The i18n
  // provider isn't mounted at the `global-error` boundary by design
  // (this is the catch-all when the React tree explodes), so `t()` is
  // unavailable and translating dynamically would require either
  // bundling locale JSON inline or trusting a possibly-broken global —
  // neither is worth it for the rare "everything failed" path. The
  // previous `lang="ja"` triggered screen readers to pronounce English
  // text using Japanese phonology.
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#0C0C0E',
            padding: '1rem',
          }}
        >
          <h2
            style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}
          >
            Something went wrong
          </h2>
          <p
            style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem' }}
          >
            A critical error occurred. Please reload the page.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.625rem 1.5rem',
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: 'none',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
