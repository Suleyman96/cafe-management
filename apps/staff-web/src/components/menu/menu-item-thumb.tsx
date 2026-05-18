'use client';

import { useEffect, useState } from 'react';

interface MenuItemThumbProps {
  imageUrl: string | null;
  /** Class on the wrapper. Caller controls size, rounding, etc. */
  className?: string;
  /** Class on the <img> when an image is rendered. */
  imageClassName?: string;
  /** Class on the fallback emoji <span>. */
  fallbackClassName?: string;
}

/**
 * Thumbnail for a menu item that gracefully degrades to a generic emoji:
 *   - when `imageUrl` is null/empty (no image set)
 *   - when the configured `imageUrl` 404s or otherwise fails to load
 *     (deleted from storage, expired signed URL, network failure)
 *
 * The error path uses local state so each thumbnail's failure is
 * independent — a single broken image doesn't poison the rest of the list.
 *
 * `alt` is intentionally empty: in the consumers (picker rows, item cards)
 * the item name is rendered right next to the thumbnail, so the image is
 * decorative for screen-reader users. Adding the name twice would create
 * announcement noise.
 */
export function MenuItemThumb({
  imageUrl,
  className,
  imageClassName,
  fallbackClassName,
}: MenuItemThumbProps) {
  const [failed, setFailed] = useState(false);
  // Reset the failure flag when the URL changes — without this, an
  // admin's image edit (or any realtime menu_items update that reuses
  // the same React node) would keep showing the emoji fallback even
  // though the new URL is potentially loadable. The previous URL's
  // failure shouldn't poison subsequent URLs.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the effect's purpose IS to re-run on imageUrl change; the body doesn't read it
  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);
  const showFallback = !imageUrl || failed;

  return (
    <div className={className}>
      {showFallback ? (
        <span className={fallbackClassName}>🍽️</span>
      ) : (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={imageClassName}
        />
      )}
    </div>
  );
}
