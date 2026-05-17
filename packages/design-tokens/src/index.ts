/**
 * @gustri/design-tokens
 *
 * Headless design tokens — colors, spacing, typography, radii, elevation —
 * plus shared component prop contracts (`ButtonContract`, `BadgeContract`,
 * …). Web (`@gustri/ui-web`) and mobile (`@gustri/ui-mobile`) packages
 * implement components that satisfy these contracts using their respective
 * styling primitives, but the values and shapes live here.
 *
 * Headless boundary — never import React, react-dom, or react-native here.
 * The Biome `noRestrictedImports` override at the root `biome.json` enforces
 * this; violations fail `pnpm check`.
 */

export * from './colors';
export * from './components';
export * from './elevation';
export * from './radii';
export * from './spacing';
export * from './typography';
