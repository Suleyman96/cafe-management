'use client';

import { useTranslation } from '@cafe-idare/i18n';
import {
  ArrowLeft,
  Flame,
  Filter,
  Leaf,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useCategories, useMenuItems } from '@/hooks/use-menu';
import { useAddOrderItems, useCreateOrder, useOrder } from '@/hooks/use-order';
import {
  calculateTax,
  calculateTotal,
  formatPrice as formatPriceWithSettings,
  getDisplaySubtotal,
  useCafeSettings,
} from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import { cn, formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';
import { useLanguageStore } from '@/store/language-store';
import { getLocalizedField } from '@/types';
import { MenuItemCard } from './menu-item-card';

interface MenuScreenProps {
  tableId: string;
}

type DietaryFilter = 'vegetarian' | 'vegan' | 'gluten_free' | 'spicy';

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="aspect-video bg-white/[0.06]" />
      <div className="p-3">
        <div className="h-3.5 w-3/4 rounded bg-white/[0.08] mb-2" />
        <div className="h-3 w-1/2 rounded bg-white/[0.06] mb-2.5" />
        <div className="h-4 w-1/3 rounded bg-white/[0.08]" />
      </div>
    </div>
  );
}

function SkeletonPill() {
  return <div className="h-8 w-20 rounded-full bg-white/[0.06] animate-pulse flex-shrink-0" />;
}

// ─── Shared Cart Content ────────────────────────────────────────────────────
interface CartContentProps {
  tableId: string;
  accentColor: string;
  onOrderPlaced?: () => void;
}

function CartContent({ tableId, accentColor, onOrderPlaced }: CartContentProps) {
  const router = useRouter();
  const { t } = useTranslation('customer');
  const { items, updateQuantity, removeItem, clearCart, getTotal } = useCartStore();
  const [orderNotes, setOrderNotes] = useState('');

  const isDelivery = tableId === '__delivery__';

  const { data: table } = useTable(tableId);
  const actualTableId = table?.id || '';
  const { data: existingOrder } = useOrder(actualTableId);
  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();
  const { data: settings } = useCafeSettings();

  const cartSubtotal = getTotal();
  const displaySubtotal = settings ? getDisplaySubtotal(cartSubtotal, settings) : cartSubtotal;
  const tax = settings ? calculateTax(cartSubtotal, settings) : 0;
  const total = settings ? calculateTotal(cartSubtotal, settings) : cartSubtotal;
  const minimumOrderMet = !settings?.minimum_order_amount || total >= settings.minimum_order_amount;

  const priceDisplay = (amount: number) => {
    if (settings) return formatPriceWithSettings(amount, settings);
    return formatPrice(amount);
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0 || (!isDelivery && !actualTableId)) return;

    if (settings?.minimum_order_amount && total < settings.minimum_order_amount) {
      const minAmount = priceDisplay(settings.minimum_order_amount);
      toast.error(t('cart.minimumOrderToast', { amount: minAmount }));
      return;
    }

    try {
      let orderId = existingOrder?.id;

      if (!orderId) {
        const newOrder = await createOrder.mutateAsync({
          tableId: actualTableId,
          notes: orderNotes,
        });
        orderId = newOrder.id;
      }

      await addOrderItems.mutateAsync({
        orderId,
        items: items.map((item) => ({
          menu_item_id: item.menuItem.id,
          item_name: item.menuItem.name,
          item_price: item.menuItem.price,
          quantity: item.quantity,
          notes: item.notes,
        })),
      });

      toast.success(t('cart.orderSuccess'));
      clearCart();
      onOrderPlaced?.();
      router.push(`/table/${tableId}/order`);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error(t('cart.orderError'));
    }
  };

  const isPlacing = createOrder.isPending || addOrderItems.isPending;

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-3">🛒</div>
        <p className="text-sm font-medium text-white/60 mb-1">{t('cart.emptyTitle')}</p>
        <p className="text-xs text-white/30">
          {existingOrder ? t('cart.emptyWithOrder') : t('cart.emptyNoOrder')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-white">{t('cart.header')}</h2>
        <button
          onClick={clearCart}
          className="text-[11px] font-medium text-red-400/80 hover:text-red-400 transition-colors"
        >
          {t('cart.clearButton')}
        </button>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 scrollbar-hide">
        {items.map((item) => {
          const name = item.menuItem.name;
          return (
            <div
              key={item.menuItem.id}
              className="rounded-xl p-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate">{name}</h4>
                  <p className="text-[11px] text-white/30">{priceDisplay(item.menuItem.price)}</p>
                </div>
                <button
                  onClick={() => removeItem(item.menuItem.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all ml-2"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {item.notes && (
                <p className="text-[10px] text-white/30 mb-2 truncate">📝 {item.notes}</p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg transition-all active:scale-95"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <Minus className="h-3 w-3 text-white/60" />
                  </button>
                  <span className="text-xs font-bold text-white w-5 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg transition-all active:scale-95"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <Plus className="h-3 w-3 text-white/60" />
                  </button>
                </div>
                <span className="text-xs font-bold" style={{ color: accentColor }}>
                  {priceDisplay(item.menuItem.price * item.quantity)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Order Notes */}
        {settings?.allow_order_notes !== false && (
          <div className="pt-2 pb-1">
            <textarea
              className="w-full min-h-[56px] p-2.5 rounded-xl text-xs text-white placeholder:text-white/20 focus:outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              placeholder={t('cart.orderNotesPlaceholder')}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Price Summary + Place Order */}
      <div
        className="px-4 pt-3 pb-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="space-y-1.5 mb-3">
          {settings?.tax_enabled && settings?.show_tax_separately ? (
            <>
              <div className="flex justify-between text-[11px]">
                <span className="text-white/40">{t('subtotal', { ns: 'common' })}</span>
                <span className="text-white/60">{priceDisplay(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-white/40">
                  {settings.tax_label} ({settings.tax_percentage}%)
                </span>
                <span className="text-white/60">{priceDisplay(tax)}</span>
              </div>
              <div
                className="flex justify-between text-sm font-bold pt-2"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="text-white">{t('total', { ns: 'common' })}</span>
                <span style={{ color: accentColor }}>{priceDisplay(total)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-sm font-bold">
              <span className="text-white">{t('total', { ns: 'common' })}</span>
              <span style={{ color: accentColor }}>{priceDisplay(total)}</span>
            </div>
          )}
        </div>

        {/* Minimum Order Warning */}
        {settings?.minimum_order_amount && !minimumOrderMet && (
          <div
            className="mb-3 p-2 rounded-lg text-center"
            style={{
              background: 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.15)',
            }}
          >
            <p className="text-[11px] text-yellow-400/80">
              {t('cart.minimumOrder', { amount: priceDisplay(settings.minimum_order_amount) })}
            </p>
          </div>
        )}

        <button
          onClick={handlePlaceOrder}
          disabled={isPlacing || !minimumOrderMet}
          className="w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
            color: '#0C0C0E',
            boxShadow: `0 4px 20px ${accentColor}30`,
          }}
        >
          {isPlacing ? '...' : t('cart.placeOrder', { price: priceDisplay(total) })}
        </button>
      </div>
    </div>
  );
}

// ─── Main Menu Screen ───────────────────────────────────────────────────────

export function MenuScreen({ tableId }: MenuScreenProps) {
  const router = useRouter();
  const { t } = useTranslation('customer');
  const { language } = useLanguageStore();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilters, setDietaryFilters] = useState<DietaryFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const isDelivery = tableId === '__delivery__';
  const cartPath = isDelivery ? '/delivery/cart' : `/table/${tableId}/cart`;

  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: menuItems, isLoading: itemsLoading } = useMenuItems(selectedCategory);
  const { data: settings } = useCafeSettings();
  const storeItemCount = useCartStore((state) => state.getItemCount());
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    setItemCount(storeItemCount);
  }, [storeItemCount]);

  const accentColor = settings?.brand_primary_color || '#C8A97E';
  const isLoading = categoriesLoading || itemsLoading;

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];

    return menuItems.filter((item) => {
      if (searchQuery) {
        const name = getLocalizedField(item, 'name', language).toLowerCase();
        const description = getLocalizedField(item, 'description', language).toLowerCase();
        const query = searchQuery.toLowerCase();
        if (!name.includes(query) && !description.includes(query)) return false;
      }

      if (dietaryFilters.length > 0) {
        if (dietaryFilters.includes('vegetarian') && !item.is_vegetarian) return false;
        if (dietaryFilters.includes('vegan') && !item.is_vegan) return false;
        if (dietaryFilters.includes('gluten_free') && !item.is_gluten_free) return false;
        if (dietaryFilters.includes('spicy') && !item.is_spicy) return false;
      }

      return true;
    });
  }, [menuItems, searchQuery, dietaryFilters, language]);

  const toggleDietaryFilter = (filter: DietaryFilter) => {
    setDietaryFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter],
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDietaryFilters([]);
    setShowFilters(false);
  };

  const hasActiveFilters = searchQuery || dietaryFilters.length > 0;

  return (
    <div className="flex min-h-screen bg-[#0C0C0E]">
      {/* ══════ Menu Area ══════ */}
      <div className="flex-1 min-w-0 pb-24 lg:pb-4">
        {/* Sticky Header */}
        <div
          className="sticky top-0 z-10 backdrop-blur-xl"
          style={{
            background: 'rgba(12,12,14,0.92)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Top Row */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/70 transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <h1 className="text-base font-semibold text-white truncate mx-3">
              {settings?.restaurant_name || t('menu.title')}
            </h1>

            {/* Cart icon — mobile opens bottom sheet, desktop is just indicator */}
            <button
              onClick={() => {
                if (itemCount > 0) setShowMobileCart(true);
                else router.push(cartPath);
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/70 transition-all active:scale-95 lg:pointer-events-none"
            >
              <ShoppingCart className="h-4 w-4" />
              {itemCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: accentColor, color: '#0C0C0E' }}
                >
                  {itemCount}
                </span>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                type="text"
                placeholder={t('menu.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-16 py-2.5 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  ...(searchQuery
                    ? { borderColor: `${accentColor}40`, boxShadow: `0 0 0 1px ${accentColor}20` }
                    : {}),
                }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                    dietaryFilters.length > 0 ? '' : 'text-white/40',
                  )}
                  style={
                    dietaryFilters.length > 0
                      ? { backgroundColor: `${accentColor}20`, color: accentColor }
                      : { backgroundColor: 'rgba(255,255,255,0.06)' }
                  }
                >
                  <Filter className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Dietary Filters (collapsible) */}
          {showFilters && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
              {([
                { key: 'vegetarian' as DietaryFilter, icon: Leaf, color: '#22c55e', label: t('menu.filterVegetarian') },
                { key: 'vegan' as DietaryFilter, icon: Leaf, color: '#16a34a', label: t('menu.filterVegan') },
                { key: 'gluten_free' as DietaryFilter, icon: Wheat, color: '#d97706', label: t('menu.filterGlutenFree') },
                { key: 'spicy' as DietaryFilter, icon: Flame, color: '#ef4444', label: t('menu.filterSpicy') },
              ]).map(({ key, icon: Icon, color, label }) => {
                const isActive = dietaryFilters.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleDietaryFilter(key)}
                    className={cn(
                      'flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95',
                      isActive ? 'text-white' : 'text-white/50',
                    )}
                    style={{
                      background: isActive ? `${color}25` : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isActive ? `${color}50` : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <Icon className="h-3 w-3" style={{ color }} />
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
            {isLoading ? (
              <>
                <SkeletonPill />
                <SkeletonPill />
                <SkeletonPill />
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedCategory(undefined)}
                  className="whitespace-nowrap flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all active:scale-95"
                  style={
                    !selectedCategory
                      ? {
                          background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                          color: '#0C0C0E',
                          boxShadow: `0 2px 12px ${accentColor}30`,
                        }
                      : {
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.6)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }
                  }
                >
                  {t('menu.categoryAll')}
                </button>
                {categories?.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className="whitespace-nowrap flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all active:scale-95"
                    style={
                      selectedCategory === category.id
                        ? {
                            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                            color: '#0C0C0E',
                            boxShadow: `0 2px 12px ${accentColor}30`,
                          }
                        : {
                            background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }
                    }
                  >
                    {category.icon && <span className="mr-1">{category.icon}</span>}
                    {category.name}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Active Filters Indicator */}
          {hasActiveFilters && !isLoading && (
            <div className="px-4 pb-2 flex items-center gap-2">
              <span className="text-xs text-white/40">
                {t('menu.itemsFound', { count: filteredItems.length })}
              </span>
              <button
                onClick={clearFilters}
                className="text-xs font-medium px-2 py-0.5 rounded-full transition-all active:scale-95"
                style={{ color: accentColor, background: `${accentColor}15` }}
              >
                {t('menu.clearFilters')}
              </button>
            </div>
          )}
        </div>

        {/* Menu Items Grid */}
        <div className="px-4 pt-4 grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-3">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <MenuItemCard key={item.id} item={item} accentColor={accentColor} />
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <div className="text-4xl mb-3">{hasActiveFilters ? '🔍' : '🍽️'}</div>
              <p className="text-white/50 text-sm mb-4">
                {hasActiveFilters ? t('menu.noItemsFiltered') : t('menu.noItemsAvailable')}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm font-medium px-4 py-2 rounded-full transition-all active:scale-95"
                  style={{
                    background: `${accentColor}15`,
                    color: accentColor,
                    border: `1px solid ${accentColor}30`,
                  }}
                >
                  {t('menu.clearFilters')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mobile: Floating Cart Pill */}
        {itemCount > 0 && (
          <div className="fixed bottom-5 left-0 right-0 z-20 flex justify-center px-4 lg:hidden">
            <button
              onClick={() => setShowMobileCart(true)}
              className="flex items-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-semibold shadow-2xl transition-all active:scale-[0.97] backdrop-blur-sm"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                color: '#0C0C0E',
                boxShadow: `0 8px 32px ${accentColor}40, 0 0 0 1px ${accentColor}50`,
              }}
            >
              <ShoppingCart className="h-4 w-4" />
              {t('menu.viewCart', { count: itemCount })}
            </button>
          </div>
        )}
      </div>

      {/* ══════ Desktop Side Cart ══════ */}
      <div
        className="hidden lg:flex w-[340px] flex-col flex-shrink-0 sticky top-0 h-screen"
        style={{
          background: 'linear-gradient(180deg, rgba(18,18,22,1), rgba(12,12,14,1))',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <CartContent tableId={tableId} accentColor={accentColor} />
      </div>

      {/* ══════ Mobile Bottom Sheet Cart ══════ */}
      {showMobileCart && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setShowMobileCart(false)}
          />
          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden" style={{ maxHeight: '85vh' }}>
            <div
              className="flex flex-col rounded-t-3xl shadow-2xl"
              style={{
                background: 'linear-gradient(180deg, #1A1A1E, #141416)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                maxHeight: '85vh',
              }}
            >
              {/* Drag handle + close */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="w-8" />
                <div className="h-1 w-10 rounded-full bg-white/15" />
                <button
                  onClick={() => setShowMobileCart(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <CartContent
                tableId={tableId}
                accentColor={accentColor}
                onOrderPlaced={() => setShowMobileCart(false)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
