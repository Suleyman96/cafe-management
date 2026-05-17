/**
 * Shared elevation scale.
 *
 * Three levels — `rest` (default card surface), `hover` (mouse-over on web /
 * pressed on mobile), and `active` (high-attention surface like a modal or
 * pinned card). Each entry carries both the web `box-shadow` CSS and the
 * mobile shadow primitives so a consumer can spread either into the right
 * style object.
 *
 * Web `boxShadow` strings are designed to match Tailwind's `shadow-sm` /
 * `shadow-md` / `shadow-lg`, so a UI author who's used to Tailwind utilities
 * still gets the same visual.
 */

export interface ElevationStyle {
  /** Web — set as `style={{ boxShadow }}` or via a Tailwind shadow utility. */
  boxShadow: string;
  /** Mobile — iOS shadow color. */
  shadowColor: string;
  /** Mobile — iOS shadow offset. */
  shadowOffset: { width: number; height: number };
  /** Mobile — iOS shadow opacity. */
  shadowOpacity: number;
  /** Mobile — iOS shadow radius. */
  shadowRadius: number;
  /** Mobile — Android elevation. */
  elevation: number;
}

export const ELEVATION: Record<'rest' | 'hover' | 'active', ElevationStyle> = {
  rest: {
    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  hover: {
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  active: {
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
};

export type ElevationToken = keyof typeof ELEVATION;
