/**
 * Re-export of color tokens from `@gustri/design-tokens`.
 *
 * These tokens used to live in this file. They moved to a dedicated
 * `@gustri/design-tokens` package so design tokens (colors, spacing,
 * typography, radii, elevation) sit in one place that both web
 * (`@gustri/ui-web`) and mobile (`@gustri/ui-mobile`) can depend on.
 *
 * This barrel remains so existing callers importing from `@gustri/core`
 * keep working — new code should import directly from `@gustri/design-tokens`.
 *
 * Note on shape: the upstream `ORDER_STATUS_HEX`/`TABLE_STATUS_HEX`/
 * `ROLE_BADGE_HEX` records used to have a narrower value type (`{ bg, text }`).
 * They now carry the full `BadgeConfig` (`bg`, `text`, `labelKey`, optional
 * `border`/`pulse`/`iconName`). Existing consumers that destructure `bg`/`text`
 * are unaffected; the extra fields are additive and ignored when unused.
 */

export {
  type BadgeConfig,
  BRAND_PRIMARY,
  ORDER_STATUS_HEX,
  ROLE_BADGE_HEX,
  SEMANTIC_COLORS,
  type StatusColorPair,
  TABLE_STATUS_HEX,
  WAITER_CALL_REASON_HEX,
} from '@gustri/design-tokens';
