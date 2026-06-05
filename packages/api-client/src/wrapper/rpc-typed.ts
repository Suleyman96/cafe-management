/**
 * Typed RPC bindings.
 *
 * Centralizes RPC invocation with end-to-end type safety from RPC name →
 * args shape → return shape, plus uniform error mapping via
 * `handleSupabaseError`. Replaces ad-hoc `ctx.anyClient.rpc(...)` calls
 * which bypass `Database['public']['Functions']` typing.
 *
 * Usage inside a wrapper:
 *
 *     const total = await rpc(ctx, 'get_order_remaining_balance', { order_uuid: id });
 *
 * The compiler will reject mistyped RPC names, missing args, or args of
 * the wrong shape. The return type is whatever `Database['public']['Functions'][name]['Returns']`
 * resolves to.
 */

import type { Database } from '@gustri/database/types';
import { handleSupabaseError } from '../errors';
import type { WrapperContext } from './types';

type Functions = Database['public']['Functions'];

export type RpcName = keyof Functions;
export type RpcArgs<N extends RpcName> = Functions[N]['Args'];
export type RpcReturns<N extends RpcName> = Functions[N]['Returns'];

type HasRequiredArgs<N extends RpcName> =
  RpcArgs<N> extends Record<string, never>
    ? false
    : RpcArgs<N> extends never
      ? false
      : keyof RpcArgs<N> extends never
        ? false
        : true;

/**
 * Invoke a Postgres RPC with full Database typing. Throws an `AppError`
 * subclass on failure (mapped via `handleSupabaseError`). Args are
 * required when the function declares any; otherwise pass nothing.
 */
export async function rpc<N extends RpcName>(
  ctx: WrapperContext,
  ...rest: HasRequiredArgs<N> extends true
    ? [name: N, args: RpcArgs<N>]
    : [name: N, args?: RpcArgs<N>]
): Promise<RpcReturns<N>> {
  const [name, args] = rest;
  // The generic N erases the per-name narrowing supabase-js needs to relate
  // `name` to its `Args` overload, so cast through `unknown` at the boundary —
  // the public signature still enforces correctness for callers.
  const { data, error } = await (
    ctx.client.rpc as unknown as (
      name: string,
      args?: unknown,
    ) => Promise<{ data: unknown; error: unknown }>
  )(name as string, args ?? {});
  if (error) throw handleSupabaseError(error as Parameters<typeof handleSupabaseError>[0]);
  return data as RpcReturns<N>;
}
