'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope);

          // Check for updates periodically
          setInterval(
            () => {
              registration.update();
            },
            60 * 60 * 1000,
          ); // Check every hour
        })
        .catch((error) => {
          Sentry.addBreadcrumb({
            category: 'sw',
            message: 'Service Worker registration failed',
            level: 'warning',
            data: { error: String(error) },
          });
        });
    }
  }, []);

  return null;
}
