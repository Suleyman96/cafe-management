// Stub for @sentry/react-native — depends on react-native which has Flow syntax
const noop = () => {};
export const init = noop;
export const captureException = noop;
export const captureMessage = noop;
export const setUser = noop;
export const addBreadcrumb = noop;
export const withScope = (cb: (scope: { setExtra: () => void; setTag: () => void }) => void) =>
  cb({ setExtra: noop, setTag: noop });
export const Severity = { Error: 'error', Warning: 'warning', Info: 'info' };
