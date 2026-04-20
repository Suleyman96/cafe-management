import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { CartScreen } from '@/components/cart/cart-screen';
import { apiRoutes } from '@/lib/api-routes';
import { db } from '@/lib/supabase';
import { useCartStore } from '@/store/cart-store';
import { renderWithProviders, screen, waitFor } from '../helpers/test-utils';

const mockMenuItem = {
  id: 'm1',
  name: 'Coffee',
  name_en: 'Coffee',
  name_az: null,
  name_ru: null,
  name_tr: null,
  price: 5,
  category_id: 'cat1',
  is_available: true,
  is_popular: false,
  is_vegetarian: false,
  is_vegan: false,
  is_spicy: false,
  is_gluten_free: false,
  allergens: [],
  image_url: null,
  description: null,
  description_en: null,
  description_az: null,
  description_ru: null,
  description_tr: null,
  preparation_time: null,
  sort_order: 0,
  created_at: '',
  updated_at: '',
};

const mockMenuItem2 = {
  ...mockMenuItem,
  id: 'm2',
  name: 'Tea',
  name_en: 'Tea',
  price: 3,
};

const defaultSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  restaurant_name: 'Test Cafe',
  tax_enabled: false,
  tax_percentage: 0,
  tax_label: 'Tax',
  prices_include_tax: false,
  show_tax_separately: false,
  currency_symbol: '$',
  currency_code: 'USD',
  currency_position: 'before',
  currency_decimal_places: 2,
  minimum_order_amount: 0,
  allow_item_notes: true,
  allow_order_notes: true,
  cafe_logo_url: null,
  hero_image_url: null,
  brand_primary_color: '#367B8B',
  brand_secondary_color: '#1E40AF',
  welcome_heading: null,
  welcome_message: null,
  qr_ordering_enabled: true,
  tips_enabled: false,
  waste_tracking_enabled: false,
  delivery_enabled: false,
  delivery_fee_default: 0,
  minimum_delivery_amount: 0,
  delivery_zone_info: null,
  restaurant_address: null,
  contact_phone: null,
  contact_website: null,
  social_instagram: null,
  social_whatsapp: null,
  social_tiktok: null,
  social_telegram: null,
  social_line: null,
  location_maps_url: null,
  default_language: 'en',
  created_at: '',
  updated_at: '',
};

describe('CartScreen — checkout flow', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it('shows empty state when cart has no items', () => {
    (db.settings.get as any).mockResolvedValueOnce(defaultSettings);

    renderWithProviders(<CartScreen tableId="T01" />);

    expect(screen.getByText('cart.emptyTitle')).toBeInTheDocument();
  });

  it('placing order creates order then adds items', async () => {
    const user = userEvent.setup();

    // Pre-populate cart with 2 items
    useCartStore.getState().addItem(mockMenuItem as any, 2, 'No ice');
    useCartStore.getState().addItem(mockMenuItem2 as any, 1);

    // Mock table lookup
    (db.tables.findByTableNumber as any).mockResolvedValueOnce({
      id: 'uuid-t1',
      table_number: 'T01',
      status: 'occupied',
      location: null,
      tenant_id: 'tenant-1',
    });

    // Mock no existing order for this table
    (db.orders.findActiveByTable as any).mockResolvedValueOnce(null);

    // Mock settings
    (db.settings.get as any).mockResolvedValueOnce(defaultSettings);

    // Mock order creation via API route
    (apiRoutes.customerOrders.create as any).mockResolvedValueOnce({
      order: { id: 'order-1', status: 'pending_approval' },
    });

    // Mock order items creation via API route
    (apiRoutes.customerOrders.addItems as any).mockResolvedValueOnce({ items: [] });

    renderWithProviders(<CartScreen tableId="T01" />);

    // Wait for the table data to resolve so actualTableId is populated
    await waitFor(() => {
      expect(screen.queryByText('cart.emptyTitle')).not.toBeInTheDocument();
    });

    // Find and click the place order button (text includes the i18n key "cart.placeOrder")
    const placeOrderButton = await screen.findByRole('button', {
      name: /cart\.placeOrder/,
    });
    await user.click(placeOrderButton);

    // Assert apiRoutes.customerOrders.create was called with the correct table_id
    await waitFor(() => {
      expect(apiRoutes.customerOrders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          table_id: 'uuid-t1',
          order_type: 'dine_in',
        }),
      );
    });

    // Assert apiRoutes.customerOrders.addItems was called with the items
    await waitFor(() => {
      expect(apiRoutes.customerOrders.addItems).toHaveBeenCalledWith(
        'order-1',
        expect.arrayContaining([
          expect.objectContaining({
            menu_item_id: 'm1',
            quantity: 2,
          }),
          expect.objectContaining({
            menu_item_id: 'm2',
            quantity: 1,
          }),
        ]),
      );
    });
  });

  it('minimum order prevents checkout', async () => {
    const user = userEvent.setup();

    // Pre-populate cart with a low-priced item (total = 10)
    useCartStore.getState().addItem(mockMenuItem as any, 2); // 5 * 2 = 10

    // Mock table lookup
    (db.tables.findByTableNumber as any).mockResolvedValueOnce({
      id: 'uuid-t1',
      table_number: 'T01',
      status: 'occupied',
      location: null,
      tenant_id: 'tenant-1',
    });

    // Mock no existing order
    (db.orders.findActiveByTable as any).mockResolvedValueOnce(null);

    // Mock settings with minimum_order_amount: 50
    (db.settings.get as any).mockResolvedValueOnce({
      ...defaultSettings,
      minimum_order_amount: 50,
    });

    renderWithProviders(<CartScreen tableId="T01" />);

    // Wait for the component to render with items
    await waitFor(() => {
      expect(screen.queryByText('cart.emptyTitle')).not.toBeInTheDocument();
    });

    // The place order button should be disabled when minimum is not met
    const placeOrderButton = await screen.findByRole('button', {
      name: /cart\.placeOrder|minimumOrderNotMet/,
    });
    await user.click(placeOrderButton);

    // Assert apiRoutes.customerOrders.create was NOT called
    expect(apiRoutes.customerOrders.create).not.toHaveBeenCalled();
  });

  it('cart clears after successful order', async () => {
    const user = userEvent.setup();

    // Pre-populate cart
    useCartStore.getState().addItem(mockMenuItem as any, 1);

    // Mock table lookup
    (db.tables.findByTableNumber as any).mockResolvedValueOnce({
      id: 'uuid-t1',
      table_number: 'T01',
      status: 'occupied',
      location: null,
      tenant_id: 'tenant-1',
    });

    // Mock no existing order
    (db.orders.findActiveByTable as any).mockResolvedValueOnce(null);

    // Mock settings
    (db.settings.get as any).mockResolvedValueOnce(defaultSettings);

    // Mock successful order creation
    (apiRoutes.customerOrders.create as any).mockResolvedValueOnce({
      order: { id: 'order-1', status: 'pending_approval' },
    });
    (apiRoutes.customerOrders.addItems as any).mockResolvedValueOnce({ items: [] });

    renderWithProviders(<CartScreen tableId="T01" />);

    // Wait for the component to render with items
    await waitFor(() => {
      expect(screen.queryByText('cart.emptyTitle')).not.toBeInTheDocument();
    });

    // Click place order
    const placeOrderButton = await screen.findByRole('button', {
      name: /cart\.placeOrder/,
    });
    await user.click(placeOrderButton);

    // Wait for the order to complete and cart to clear
    await waitFor(() => {
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    // Verify success toast was shown
    expect(toast.success).toHaveBeenCalled();
  });
});
