import { useRouter } from 'next/navigation';
import { DeliveryMenuContent } from '@/components/menu/delivery-menu-content';
import { useDeliveryStore } from '@/store/delivery-store';
import { renderWithProviders, waitFor } from '../../helpers/test-utils';

// Stub MenuScreen so the test stays focused on the guard. The real
// MenuScreen pulls the cart store + queries and is exercised elsewhere.
vi.mock('@/components/menu/menu-screen', () => ({
  MenuScreen: () => <div data-testid="menu-screen">menu</div>,
}));

const initialCategories: any[] = [];
const initialMenuItems: any[] = [];

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
});

describe('DeliveryMenuContent — L5 guard', () => {
  it('renders the menu when customerName, deliveryAddress, and qrToken are all set', async () => {
    useDeliveryStore.setState({
      customerName: 'Alice',
      customerPhone: '+15551234567',
      deliveryAddress: '1 Main St',
      deliveryNotes: '',
      lastOrderId: null,
      qrToken: 'tkn_legit',
    });

    const { getByTestId } = renderWithProviders(
      <DeliveryMenuContent
        initialCategories={initialCategories}
        initialMenuItems={initialMenuItems}
      />,
    );

    expect(getByTestId('menu-screen')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects to /delivery when qrToken is missing (L5)', async () => {
    // Customer hit /delivery/menu directly (or a stale persisted store
    // without the token from the QR `?token=…`). Cart submit would later
    // fail with `missingQrToken`; redirecting here surfaces the broken
    // entry path immediately instead of letting the customer browse a
    // menu they can never check out from.
    useDeliveryStore.setState({
      customerName: 'Alice',
      customerPhone: '+15551234567',
      deliveryAddress: '1 Main St',
      deliveryNotes: '',
      lastOrderId: null,
      qrToken: null,
    });

    renderWithProviders(
      <DeliveryMenuContent
        initialCategories={initialCategories}
        initialMenuItems={initialMenuItems}
      />,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/delivery');
    });
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

    renderWithProviders(
      <DeliveryMenuContent
        initialCategories={initialCategories}
        initialMenuItems={initialMenuItems}
      />,
    );

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

    renderWithProviders(
      <DeliveryMenuContent
        initialCategories={initialCategories}
        initialMenuItems={initialMenuItems}
      />,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/delivery');
    });
  });
});
