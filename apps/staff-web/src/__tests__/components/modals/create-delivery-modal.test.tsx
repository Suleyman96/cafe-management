import type { MenuItem } from '@gustri/database';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../helpers/test-utils';

// Behavior under test (migrations 20260515000005 + 20260515000006):
//   - Submit gate requires customer_name + at least one item ONLY.
//     Phone and address are optional.
//   - Empty phone/address are sent as `null`, not `''`, so the encrypted
//     PII columns don't accumulate empty-string ciphertext.
//   - `createDeliveryCustomer` is skipped for name-only entries — the
//     saved-customer search is keyed on phone_hash, so name-only stubs
//     would just clutter the directory.

const mockCreateOrder = {
  isPending: false,
  mutateAsync: vi.fn().mockResolvedValue({ id: 'order-1' }),
};
const mockAddOrderItems = {
  isPending: false,
  mutateAsync: vi.fn().mockResolvedValue([{ id: 'item-1' }]),
};
const mockCreateDeliveryCustomer = { mutate: vi.fn() };
const mockIncrementOrderCount = { mutate: vi.fn() };

vi.mock('@/hooks', () => ({
  useCreateOrder: () => mockCreateOrder,
  useAddOrderItems: () => mockAddOrderItems,
  useCreateDeliveryCustomer: () => mockCreateDeliveryCustomer,
  useIncrementDeliveryCustomerOrderCount: () => mockIncrementOrderCount,
  useCafeSettings: () => ({
    data: {
      tax_enabled: false,
      tax_percentage: 0,
      delivery_fee_default: 0,
      currency_symbol: '$',
    },
  }),
  useTaxMultiplier: () => 1,
  useSearchDeliveryCustomers: () => ({ data: [] }),
}));

vi.mock('@/hooks/use-format-price', () => ({
  useFormatPrice: () => (n: number) => `$${n.toFixed(2)}`,
}));

vi.mock('@/hooks/use-is-online', () => ({
  useIsOnline: () => true,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import { CreateDeliveryModal } from '@/components/modals/create-delivery-modal';

const menuItem: MenuItem = {
  id: 'mi-1',
  name: 'Test Burger',
  description: null,
  price: 10,
  category_id: 'cat-1',
  image_url: null,
  is_available: true,
  is_featured: false,
  position: 0,
  tenant_id: 't1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as MenuItem;

function renderModal() {
  return renderWithProviders(
    <CreateDeliveryModal
      staffId="staff-1"
      menuItems={[menuItem]}
      isOpen={true}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );
}

function fillName(value: string) {
  // The first text input in the form is the customer-name field; the
  // saved-customer search above it is `type="text"` but has a placeholder
  // we can disambiguate by reaching for the placeholder used by the name
  // input.
  const nameInput = screen
    .getAllByPlaceholderText(/delivery\.customerName|Customer Name/)
    .find((el) => (el as HTMLInputElement).type === 'text') as HTMLInputElement;
  fireEvent.change(nameInput, { target: { value } });
}

function addTestBurger() {
  fireEvent.click(screen.getByText('Test Burger'));
}

function getSubmitButton(): HTMLButtonElement {
  // The button label includes a price suffix (`· $10.00`), so match on a
  // prefix that's stable across i18n stubs.
  const buttons = screen.getAllByRole('button') as HTMLButtonElement[];
  const submit = buttons.find((b) => /delivery\.createDeliveryOrder/.test(b.textContent ?? ''));
  if (!submit) throw new Error('submit button not found');
  return submit;
}

describe('CreateDeliveryModal — name-only delivery (M5 relaxation)', () => {
  afterEach(() => {
    mockCreateOrder.mutateAsync.mockClear();
    mockAddOrderItems.mutateAsync.mockClear();
    mockCreateDeliveryCustomer.mutate.mockClear();
    mockIncrementOrderCount.mutate.mockClear();
  });

  it('submit button is disabled with no name and no items', () => {
    renderModal();
    expect(getSubmitButton().disabled).toBe(true);
  });

  it('submit button stays disabled with name but no items', () => {
    renderModal();
    fillName('Phone-In Customer');
    expect(getSubmitButton().disabled).toBe(true);
  });

  it('submit button enables with name + at least one item (no phone, no address)', () => {
    renderModal();
    fillName('Phone-In Customer');
    addTestBurger();
    expect(getSubmitButton().disabled).toBe(false);
  });

  it('submitting name-only delivery sends null for phone and address', async () => {
    renderModal();
    fillName('Phone-In Customer');
    addTestBurger();
    fireEvent.click(getSubmitButton());

    await waitFor(() => expect(mockCreateOrder.mutateAsync).toHaveBeenCalled());

    const payload = mockCreateOrder.mutateAsync.mock.calls[0][0];
    expect(payload.order_type).toBe('delivery');
    expect(payload.customer_name).toBe('Phone-In Customer');
    expect(payload.customer_phone).toBeNull();
    expect(payload.delivery_address).toBeNull();
  });

  it('does NOT save a customer profile when name is the only field filled', async () => {
    renderModal();
    fillName('Phone-In Customer');
    addTestBurger();
    fireEvent.click(getSubmitButton());

    await waitFor(() => expect(mockCreateOrder.mutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(mockAddOrderItems.mutateAsync).toHaveBeenCalled());

    expect(mockCreateDeliveryCustomer.mutate).not.toHaveBeenCalled();
  });

  it('saves a customer profile when at least an address is filled', async () => {
    renderModal();
    fillName('Address-Only Customer');

    const addressInput = screen.getByPlaceholderText(/fullDeliveryAddress|Full delivery/);
    fireEvent.change(addressInput, { target: { value: '1 Test St' } });

    addTestBurger();
    fireEvent.click(getSubmitButton());

    await waitFor(() => expect(mockCreateOrder.mutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(mockCreateDeliveryCustomer.mutate).toHaveBeenCalled());

    const profilePayload = mockCreateDeliveryCustomer.mutate.mock.calls[0][0];
    expect(profilePayload.name).toBe('Address-Only Customer');
    expect(profilePayload.address).toBe('1 Test St');
    expect(profilePayload.phone).toBeNull();
  });
});
