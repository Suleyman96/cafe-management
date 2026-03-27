/**
 * Returns YYYY-MM-DD string in the device's local timezone.
 * Replaces `new Date().toISOString().split('T')[0]` which returns UTC date
 * and produces wrong results near midnight in non-UTC timezones.
 */
export function getLocalDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA');
}
