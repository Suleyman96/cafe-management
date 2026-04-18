/**
 * Mock Supabase client for integration testing.
 * Returns a chainable query builder that resolves to configured responses.
 */

interface MockResponse {
  data: any;
  error: any;
  count?: number;
}

function createChainableQuery(response: MockResponse) {
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
    builder[method] = (..._args: any[]) => builder;
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
          return createChainableQuery(response);
        },
        insert: (data: any) => {
          calls.push({ table, method: 'insert', args: [data] });
          return createChainableQuery(response);
        },
        update: (data: any) => {
          calls.push({ table, method: 'update', args: [data] });
          return createChainableQuery(response);
        },
        delete: () => {
          calls.push({ table, method: 'delete', args: [] });
          return createChainableQuery(response);
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
        on: (..._args: any[]) => channelObj,
        subscribe: () => channelObj,
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

export function createMockContext(config: MockSupabaseConfig = {}) {
  const client = createMockSupabase(config);
  return {
    client,
    anyClient: client,
    getCalls: client.getCalls,
    resetCalls: client.resetCalls,
  };
}
