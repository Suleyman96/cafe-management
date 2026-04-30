'use client';

/**
 * Web-only UI components — components that depend on DOM types
 * (`HTMLInputElement`, `document`, `window`, scroll/wheel events) and so
 * cannot live in `@gustri/ui` if that package is to remain importable
 * from React Native. Consumed by `apps/staff-web` and `apps/customer-web`
 * only; mobile must not depend on this package.
 */
export * from './number-input';
