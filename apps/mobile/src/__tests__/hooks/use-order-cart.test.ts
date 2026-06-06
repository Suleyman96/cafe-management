import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOrderCart } from '@/hooks/use-order-cart';

describe('useOrderCart', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useOrderCart());
    expect(result.current.hasItems).toBe(false);
    expect(result.current.subtotal).toBe(0);
    expect(result.current.count).toBe(0);
    expect(result.current.getQuantity('x')).toBe(0);
  });

  it('addItem creates a line at qty 1, then increments', () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addItem({ id: 'a', price: 5, name: 'Apple' }));
    expect(result.current.getQuantity('a')).toBe(1);
    act(() => result.current.addItem({ id: 'a', price: 5, name: 'Apple' }));
    expect(result.current.getQuantity('a')).toBe(2);
    expect(result.current.hasItems).toBe(true);
  });

  it('computes subtotal and count across lines', () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => {
      result.current.addItem({ id: 'a', price: 5, name: 'Apple' });
      result.current.addItem({ id: 'a', price: 5, name: 'Apple' });
      result.current.addItem({ id: 'b', price: 3, name: 'Bread' });
    });
    expect(result.current.subtotal).toBe(5 * 2 + 3); // 13
    expect(result.current.count).toBe(3);
    expect(result.current.cartItems).toHaveLength(2);
  });

  it('updateQty adjusts and removes the line at qty <= 0', () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addItem({ id: 'a', price: 5, name: 'Apple' }));
    act(() => result.current.updateQty('a', 2));
    expect(result.current.getQuantity('a')).toBe(3);
    act(() => result.current.updateQty('a', -3));
    expect(result.current.getQuantity('a')).toBe(0);
    expect(result.current.hasItems).toBe(false);
  });

  it('updateQty is a no-op for a missing line', () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.updateQty('missing', 1));
    expect(result.current.getQuantity('missing')).toBe(0);
    expect(result.current.cartItems).toHaveLength(0);
  });

  it('removeItem decrements by one and deletes at zero', () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => {
      result.current.addItem({ id: 'a', price: 5, name: 'Apple' });
      result.current.addItem({ id: 'a', price: 5, name: 'Apple' });
    });
    act(() => result.current.removeItem('a'));
    expect(result.current.getQuantity('a')).toBe(1);
    act(() => result.current.removeItem('a'));
    expect(result.current.getQuantity('a')).toBe(0);
  });

  it('falls back to the default name when item name is null/undefined', () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => result.current.addItem({ id: 'a', price: 5, name: null }));
    expect(result.current.cartItems[0].name).toBe('Item');
  });

  it('honors a custom fallbackName option', () => {
    const { result } = renderHook(() => useOrderCart({ fallbackName: 'Unnamed' }));
    act(() => result.current.addItem({ id: 'a', price: 5 }));
    expect(result.current.cartItems[0].name).toBe('Unnamed');
  });

  it('clear empties the cart', () => {
    const { result } = renderHook(() => useOrderCart());
    act(() => {
      result.current.addItem({ id: 'a', price: 5, name: 'Apple' });
      result.current.addItem({ id: 'b', price: 3, name: 'Bread' });
    });
    act(() => result.current.clear());
    expect(result.current.hasItems).toBe(false);
    expect(result.current.cartItems).toHaveLength(0);
  });
});
