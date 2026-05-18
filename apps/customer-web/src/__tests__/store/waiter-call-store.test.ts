import { useWaiterCallIdempotency } from '@/store/waiter-call-store';

beforeEach(() => {
  useWaiterCallIdempotency.setState({ pendingClientRequestId: null });
});

describe('useWaiterCallIdempotency (C2)', () => {
  it('mints a UUID on first consume()', () => {
    const id = useWaiterCallIdempotency.getState().consume();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns the same id across multiple consume() calls until reset', () => {
    // Why this matters: the FAB in `app/table/[tableId]/layout.tsx` and the
    // "Call Staff" button in `order-status.tsx` are mounted simultaneously
    // while the customer is on `/table/[tableId]/order`. A double-tap that
    // crosses surfaces must reuse the same id so the server-side
    // (tenant_id, client_request_id) partial unique index dedupes.
    const first = useWaiterCallIdempotency.getState().consume();
    const second = useWaiterCallIdempotency.getState().consume();
    const third = useWaiterCallIdempotency.getState().consume();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('reset() clears the pending id so the next consume() mints a fresh one', () => {
    const original = useWaiterCallIdempotency.getState().consume();
    useWaiterCallIdempotency.getState().reset();
    const next = useWaiterCallIdempotency.getState().consume();
    expect(next).not.toBe(original);
  });
});
