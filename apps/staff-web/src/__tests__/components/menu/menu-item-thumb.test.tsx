import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MenuItemThumb } from '@/components/menu/menu-item-thumb';

// Behavior under test:
//   1. Renders <img> with the given URL + lazy/async hints when a URL is set.
//   2. Falls back to the 🍽️ emoji when imageUrl is null OR empty string.
//   3. Falls back when the image fires onError (404, broken URL, etc).
//   4. The failure flag is per-instance — when imageUrl changes (admin
//      edits an item, realtime update), the previous URL's failure
//      doesn't poison the new URL.
//   5. Image is decorative (alt="") — see component-level comment.

describe('MenuItemThumb', () => {
  it('renders <img> with lazy + async-decode hints when imageUrl is set', () => {
    const { container } = render(<MenuItemThumb imageUrl="https://example/img.png" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://example/img.png');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('alt', '');
  });

  it('renders the emoji fallback when imageUrl is null', () => {
    const { container, getByText } = render(<MenuItemThumb imageUrl={null} />);
    expect(getByText('🍽️')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the emoji fallback when imageUrl is empty string', () => {
    // Defensive — DB returns null but `image_url=""` could sneak in from
    // a form submit or migration. Should behave identically to null.
    const { container, getByText } = render(<MenuItemThumb imageUrl="" />);
    expect(getByText('🍽️')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('switches to the emoji fallback after the image fires onError', () => {
    const { container, getByText, queryByText } = render(
      <MenuItemThumb imageUrl="https://example/broken.png" />,
    );
    // Sanity: before the error, the <img> is rendered and there is no emoji.
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(queryByText('🍽️')).not.toBeInTheDocument();

    // Simulate the browser firing the load error (404, CORS, etc).
    fireEvent.error(img as HTMLImageElement);

    expect(getByText('🍽️')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('resets the failure flag when imageUrl changes (the prop-change reset)', () => {
    // Regression guard for the bug the review found: without the
    // useEffect reset, a previously-failed URL would keep the emoji
    // fallback rendered even after the parent passes a new (potentially
    // working) URL. Realtime menu_items updates trigger exactly this
    // pattern when React reuses the existing node.
    const { container, rerender, queryByText } = render(
      <MenuItemThumb imageUrl="https://example/old-broken.png" />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(queryByText('🍽️')).toBeInTheDocument();

    rerender(<MenuItemThumb imageUrl="https://example/new-working.png" />);

    // After the URL change, the failed flag must reset so the new URL
    // gets a fair chance to load.
    expect(queryByText('🍽️')).not.toBeInTheDocument();
    const newImg = container.querySelector('img');
    expect(newImg).toHaveAttribute('src', 'https://example/new-working.png');
  });

  it('forwards className / imageClassName / fallbackClassName to the right nodes', () => {
    // Important contract: callers depend on these for size/spacing (the
    // shared picker uses w-12 h-12; the table-detail card uses aspect-[4/3]).
    // A regression where these don't pass through silently breaks layout.
    const { container, getByText, rerender } = render(
      <MenuItemThumb
        imageUrl="https://example/img.png"
        className="wrapper-class"
        imageClassName="image-class"
        fallbackClassName="fallback-class"
      />,
    );
    expect(container.firstElementChild).toHaveClass('wrapper-class');
    expect(container.querySelector('img')).toHaveClass('image-class');

    rerender(
      <MenuItemThumb
        imageUrl={null}
        className="wrapper-class"
        imageClassName="image-class"
        fallbackClassName="fallback-class"
      />,
    );
    expect(getByText('🍽️')).toHaveClass('fallback-class');
  });
});
