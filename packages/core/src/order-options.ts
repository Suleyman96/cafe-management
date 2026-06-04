/**
 * Order-item modifier snapshot helpers.
 *
 * `order_items.selected_options` is a JSONB array written server-side at order
 * time (see customer-order-service): an immutable snapshot of the chosen
 * modifier values so the order/kitchen view is stable even if the menu changes.
 * These helpers parse that untyped JSON defensively for display.
 */

export interface OrderItemSelectedOption {
  option_id: string;
  option_name: string;
  value_id: string;
  value_name: string;
  price_delta: number;
}

/** Defensively parse `order_items.selected_options` (JSONB) into typed rows. */
export function parseSelectedOptions(value: unknown): OrderItemSelectedOption[] {
  if (!Array.isArray(value)) return [];
  const out: OrderItemSelectedOption[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { value_name?: unknown }).value_name === 'string'
    ) {
      const o = entry as Record<string, unknown>;
      out.push({
        option_id: String(o.option_id ?? ''),
        option_name: String(o.option_name ?? ''),
        value_id: String(o.value_id ?? ''),
        value_name: String(o.value_name),
        price_delta: Number(o.price_delta ?? 0),
      });
    }
  }
  return out;
}

/** Compact, comma-joined value names for an order item, e.g. "Large, Extra cheese". */
export function formatSelectedOptions(value: unknown): string {
  return parseSelectedOptions(value)
    .map((o) => o.value_name)
    .join(', ');
}
