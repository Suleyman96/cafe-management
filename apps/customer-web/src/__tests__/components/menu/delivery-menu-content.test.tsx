import { useRouter } from 'next/navigation';
import { DeliveryMenuContent } from '@/components/menu/delivery-menu-content';
import { apiRoutes } from '@/lib/api-routes';
import { bindCustomerTenantContext } from '@/lib/supabase';
import { useDeliveryStore } from '@/store/delivery-store';
import { renderWithProviders, waitFor } from '../../helpers/test-utils';

// Stub MenuScreen so the test stays focused on the guard + token-resolve
// flow. The real MenuScreen pulls the cart store + queries and is
// exercised elsewhere.
vi.mock('@/components/menu/menu-screen', () => ({
  MenuScreen: () => <div data-testid="menu-screen">menu</div>,
}));

const replaceMock = vi.fn();

beforeEach(() => {
  replaceMock.mockClear();
  (useRouter as any).mockReturnValue({
    push: vi.fn(),
    replace: replaceMock,
    back: vi.fn(),
    refresh: vi.fn(),
  });
  // Reset the persisted Zustand store between tests.
  useDeliveryStore.setState({
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    deliveryNotes: '',
    lastOrderId: null,
    qrToken: null,
  });
  // Reset apiRoutes mocks — setup.ts seeds defaults, vi.clearAllMocks
  // wipes them, individual tests opt into specific resolutions.
  (apiRoutes.customerQrTokens.resolve as any).mockResolvedValue({ tenant_id: 'test-tenant-id' });
  (bindCustomerTenantContext as any).mockClear?.();
});

describe('DeliveryMenuContent — L5 guard', () => {
  it('renders MenuScreen and binds tenant when all three pieces are present', async () => {
    useDeliveryStore.setState({
      customerName: 'Alice',
      customerPhone: '+15551234567',
      deliveryAddress: '1 Main St',
      deliveryNotes: '',
      lastOrderId: null,
      qrToken: 'tkn_legit',
    });

    const { findByTestId } = renderWithProviders(<DeliveryMenuContent />);

    expect(await findByTestId('menu-screen')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    // Audit deferred SSR fix — the resolved tenant_id binds to the
    // wrapper so subsequent useMenuItems / useCategories scope reads.
    // S4 — the bind now flows through `bindCustomerTenantContext`
    // (Sentry-audited entry point) rather than calling
    // `db.setTenantContext` directly.
    await waitFor(() => {
      expect(bindCustomerTenantContext).toHaveBeenCalledWith('test-tenant-id', 'delivery-context');
    });
  });

  it('redirects to /delivery when qrToken is missing (L5)', async () => {
    // Customer hit /delivery/menu directly (or a stale persisted store
    // without the token from the QR `?token=…`). The wrapper would
    // never get tenant context, so failing fast here is preferable to
    // letting the customer browse and break at cart submit.
    useDeliveryStore.setState({
      customerName: 'Alice',
      customerPhone: '+15551234567',
      deliveryAddress: '1 Main St',
      deliveryNotes: '',
      lastOrderId: null,
      qrToken: null,
    });

    renderWithProviders(<DeliveryMenuContent />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/delivery');
    });
    // No POST should fire — the hook gates on `enabled: !!qrToken`.
    expect(apiRoutes.customerQrTokens.resolve).not.toHaveBeenCalled();
  });

  it('redirects to /delivery when customerName is missing', async () => {
    useDeliveryStore.setState({
      customerName: '',
      customerPhone: '+15551234567',
      deliveryAddress: '1 Main St',
      deliveryNotes: '',
      lastOrderId: null,
      qrToken: 'tkn_legit',
    });

    renderWithProviders(<DeliveryMenuContent />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/delivery');
    });
  });

  it('redirects to /delivery when deliveryAddress is missing', async () => {
    useDeliveryStore.setState({
      customerName: 'Alice',
      customerPhone: '+15551234567',
      deliveryAddress: '',
      deliveryNotes: '',
      lastOrderId: null,
      qrToken: 'tkn_legit',
    });

    renderWithProviders(<DeliveryMenuContent />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/delivery');
    });
  });

  it('redirects to /delivery when token resolution rejects (revoked / expired / plan_required)', async () => {
    useDeliveryStore.setState({
      customerName: 'Alice',
      customerPhone: '+15551234567',
      deliveryAddress: '1 Main St',
      deliveryNotes: '',
      lastOrderId: null,
      qrToken: 'tkn_revoked',
    });
    (apiRoutes.customerQrTokens.resolve as any).mockRejectedValueOnce(
      new Error('invalid_qr_token'),
    );

    renderWithProviders(<DeliveryMenuContent />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/delivery');
    });
    // Wrapper must NOT receive a tenant binding from a rejected resolve —
    // a stale tenant id from a prior session would otherwise leak through.
    expect(bindCustomerTenantContext).not.toHaveBeenCalled();
  });
});
