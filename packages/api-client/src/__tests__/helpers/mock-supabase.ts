/**
 * Mock Supabase client for integration testing.
 * Returns a chainable query builder that resolves to configured responses.
 */

interface MockResponse {
  data: any;
  error: any;
  count?: number;
}

function createChainableQuery(
  response: MockResponse,
  recordCall?: (method: string, args: any[]) => void,
) {
  const builder: Record<string, any> = {};

  const chainMethods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'in',
    'is',
    'or',
    'ilike',
    'like',
    'gt',
    'gte',
    'lt',
    'lte',
    'order',
    'limit',
    'range',
    'single',
    'maybeSingle',
  ];

  for (const method of chainMethods) {
    builder[method] = (...args: any[]) => {
      recordCall?.(method, args);
      return builder;
    };
  }

  // biome-ignore lint/suspicious/noThenProperty: required to make the mock chainable like Supabase queries
  builder.then = (resolve: (value: MockResponse) => void) => {
    resolve(response);
  };

  return builder;
}

export interface MockSupabaseConfig {
  responses?: Record<string, MockResponse>;
  rpcResponses?: Record<string, MockResponse>;
  defaultResponse?: MockResponse;
}

export function createMockSupabase(config: MockSupabaseConfig = {}) {
  const defaultResponse: MockResponse = config.defaultResponse || { data: [], error: null };
  const calls: Array<{ table: string; method: string; args: any[] }> = [];

  const client = {
    from: (table: string) => {
      const response = config.responses?.[table] || defaultResponse;

      return {
        select: (...args: any[]) => {
          calls.push({ table, method: 'select', args });
          return createChainableQuery(response, (method, args) => {
            calls.push({ table, method, args });
          });
        },
        insert: (data: any) => {
          calls.push({ table, method: 'insert', args: [data] });
          return createChainableQuery(response, (method, args) => {
            calls.push({ table, method, args });
          });
        },
        update: (data: any) => {
          calls.push({ table, method: 'update', args: [data] });
          return createChainableQuery(response, (method, args) => {
            calls.push({ table, method, args });
          });
        },
        delete: () => {
          calls.push({ table, method: 'delete', args: [] });
          return createChainableQuery(response, (method, args) => {
            calls.push({ table, method, args });
          });
        },
      };
    },
    rpc: (fnName: string, params?: any) => {
      calls.push({ table: '__rpc', method: fnName, args: [params] });
      const response = config.rpcResponses?.[fnName] || defaultResponse;
      return createChainableQuery(response);
    },
    channel: (name: string) => {
      calls.push({ table: '__channel', method: 'channel', args: [name] });
      const channelObj: Record<string, any> = {
        on: (...args: any[]) => {
          calls.push({ table: '__channel', method: 'on', args });
          return channelObj;
        },
        subscribe: (cb?: (status: string) => void) => {
          if (cb) cb('SUBSCRIBED');
          return channelObj;
        },
        unsubscribe: () => {
          calls.push({ table: '__channel', method: 'unsubscribe', args: [] });
        },
      };
      return channelObj;
    },
    removeChannel: (_channel: any) => {
      calls.push({ table: '__channel', method: 'removeChannel', args: [] });
    },
    getCalls: () => calls,
    resetCalls: () => {
      calls.length = 0;
    },
  };

  return client as any;
}

export interface MockContextOptions extends MockSupabaseConfig {
  /** Initial tenant id for the mock wrapper context. Defaults to null. */
  tenantId?: string | null;
  /** Capture-message hook to assert dev-only Sentry warnings in tests. */
  sentry?: { captureMessage: (message: string, options?: { level?: string }) => void };
}

export function createMockContext(options: MockContextOptions = {}) {
  const client = createMockSupabase(options);
  const tenantContext = {
    tenantId: options.tenantId ?? null,
    setTenantId(id: string | null) {
      tenantContext.tenantId = id;
    },
  };
  return {
    client,
    anyClient: client,
    tenantContext,
    sentry: options.sentry,
    getCalls: client.getCalls,
    resetCalls: client.resetCalls,
  };
}
