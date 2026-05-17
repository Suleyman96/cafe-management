import type { ScreenHeaderOptions } from '@gustri/ui-mobile';
import type { StackNavigationOptions } from '@react-navigation/stack';

/**
 * Identity helper that intersects React Navigation's `StackNavigationOptions`
 * with the shared `ScreenHeaderOptions` contract from `@gustri/ui-mobile`.
 *
 * Why here and not in `@gustri/ui-mobile`: the package can't import
 * `@react-navigation/stack` types without producing two pnpm peer-resolution
 * hashes that fail the `Stack.Screen options` assignability check at the
 * call sites.
 */
export function headerOptions(
  options: StackNavigationOptions & ScreenHeaderOptions,
): StackNavigationOptions {
  return options as StackNavigationOptions;
}
