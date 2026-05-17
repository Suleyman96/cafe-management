/**
 * Re-export of the `react-native-paper` Text / TextInput type-compat
 * shim from `@gustri/ui-mobile`. The shim lives there because
 * `FilterChipBar` and other shared mobile UI components rely on it for
 * `numberOfLines` / `keyboardType` typing under React 19. Keeping a
 * single source means callers across the mobile app see identical
 * wrapped types.
 */

export { Text, TextInput } from '@gustri/ui-mobile';
