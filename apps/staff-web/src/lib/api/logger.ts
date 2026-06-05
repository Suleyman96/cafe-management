/**
 * Structured server-side logger (ADD-9).
 *
 * Emits a single line of JSON per event so log aggregators (and `jq` in a
 * pinch) can filter by `request_id`, `route`, or `level` instead of grepping
 * free-form prose. Every entry SHOULD carry a `request_id` (see
 * `./request-id.ts`) so a log line correlates to the Sentry event and the
 * client error report for the same HTTP request.
 *
 * Why not pino? Middleware runs on the Edge runtime, where pino's
 * worker-thread transport doesn't load, and pino would add a dependency +
 * Next.js `serverComponentsExternalPackages` config for a pre-launch app
 * whose errors already flow to Sentry. A dependency-free `console`-backed
 * JSON writer works in both Edge and Node and delivers the correlation
 * payoff. If/when log volume justifies it, swap the `write()` body for pino
 * — the public `log*` surface here can stay identical.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  /** Correlation ID tying this line to one HTTP request. */
  request_id?: string;
  /** Route path, e.g. `/api/v1/orders`. */
  route?: string;
  /** HTTP method. */
  method?: string;
  /** Resolved HTTP status, when known. */
  status?: number;
  [key: string]: unknown;
}

function write(level: LogLevel, msg: string, fields?: LogFields): void {
  const entry = {
    level,
    msg,
    // `new Date().toISOString()` is fine in app runtimes (unlike workflow
    // scripts). Stamped here so every line is independently sortable.
    ts: new Date().toISOString(),
    ...fields,
  };
  // Route through the matching console method so platform log levels
  // (Vercel/Sentry breadcrumbs) classify correctly. Single-line JSON.
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => write('debug', msg, fields),
  info: (msg: string, fields?: LogFields) => write('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => write('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => write('error', msg, fields),
};
