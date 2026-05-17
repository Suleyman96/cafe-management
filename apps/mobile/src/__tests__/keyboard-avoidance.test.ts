import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Automated proxy for MOBILE_PARITY_PLAN.md Phase 5.5 ("One-handed payment
// test — take partial cash payment on iPhone 13 mini standing up, keyboard
// open. CTA stays reachable").
//
// We can't run a thumb-reach study against a glare-affected iPhone in CI.
// What we CAN do is lock the structural prerequisite: every long form that
// has the user typing into an input must wrap its content in
// `KeyboardAvoidingView`, otherwise the CTA gets pushed below the keyboard
// on a narrow viewport. The 4 files below are the canonical "must avoid
// the keyboard" surfaces per MOBILE_PARITY_PLAN.md §4.1.
//
// Why not a Maestro flow? A real "tap payment input, assert Pay button is
// still visible" flow needs a non-paid order in the test DB. The seed
// (supabase/seed.sql) doesn't create orders, so the flow would either
// require manual setup or silently no-op — both are anti-patterns. Once
// the test DB grows an "ordered, unpaid" fixture this guard should be
// supplemented with a Maestro flow that proves the live behavior; this
// test is the regression layer in the meantime.

const MOBILE_SRC = resolve(dirname(__filename), '..');

const KEYBOARD_AVOIDING_REQUIRED = [
  'screens/orders/OrderPaymentScreen.tsx',
  'components/tasks/TaskModal.tsx',
  'components/delivery/CreateDeliveryModal.tsx',
  'components/stock/StockMovementModal.tsx',
] as const;

describe('Phase 5.5 — keyboard-avoidance regression guard', () => {
  it.each(
    KEYBOARD_AVOIDING_REQUIRED,
  )('%s imports KeyboardAvoidingView from react-native and renders it', (relPath) => {
    const src = readFileSync(resolve(MOBILE_SRC, relPath), 'utf8');
    expect(src).toMatch(
      /import\s*\{[^}]*\bKeyboardAvoidingView\b[^}]*\}\s*from\s*['"]react-native['"]/s,
    );
    expect(src).toMatch(/<KeyboardAvoidingView\b/);
  });

  it.each(
    KEYBOARD_AVOIDING_REQUIRED,
  )("%s sets a platform-aware behavior prop (iOS 'padding')", (relPath) => {
    const src = readFileSync(resolve(MOBILE_SRC, relPath), 'utf8');
    // `KeyboardAvoidingView` without a behavior prop is the classic
    // footgun: iOS does nothing on default, Android relies on
    // `windowSoftInputMode`. The canonical pattern is
    //   behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    // — accept any platform-branching expression that returns 'padding'
    // for iOS so future tweaks (e.g. 'height' for a specific screen)
    // don't trip the guard, as long as the iOS case still pads.
    expect(src).toMatch(
      /behavior\s*=\s*\{[^}]*Platform\.OS\s*===\s*['"]ios['"][^}]*['"]padding['"][^}]*\}/,
    );
  });
});
