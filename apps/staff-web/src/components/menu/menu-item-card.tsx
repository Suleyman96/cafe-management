'use client';

import type { Database } from '@gustri/database';
import { Clock, Pencil, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { useTaxMultiplier } from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

interface MenuItemCardProps {
  item: MenuItem;
  categoryIcon?: string;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  onToggleAvailability: (id: string, currentAvailable: boolean) => void;
  onToggleTakeoutable: (id: string, currentTakeoutable: boolean) => void;
  onToggleDeliverable: (id: string, currentDeliverable: boolean) => void;
  t: (key: string, opts?: Record<string, string | number>) => string;
}

function MenuItemCardImpl({
  item,
  categoryIcon,
  onEdit,
  onDelete,
  onToggleAvailability,
  onToggleTakeoutable,
  onToggleDeliverable,
  t,
}: MenuItemCardProps) {
  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();

  return (
    <div
      className={`group relative bg-white rounded-xl border overflow-hidden transition-all hover:shadow-lg ${
        !item.is_available ? 'ring-1 ring-red-200' : 'hover:border-gray-300'
      }`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${
              !item.is_available ? 'grayscale opacity-70' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <span className="text-4xl opacity-40">{categoryIcon || '🍽️'}</span>
          </div>
        )}

        {/* Unavailable overlay */}
        {!item.is_available && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              {t('menu.unavailable')}
            </span>
          </div>
        )}

        {/* Daily special badge */}
        {item.is_daily_special && item.is_available && (
          <div className="absolute top-2 left-2">
            <span className="bg-amber-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              ✨ {t('menu.dailySpecial')}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
        {item.description && (
          <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{item.description}</p>
        )}

        {/* Price + prep time */}
        <div className="flex items-center gap-2 mt-2">
          <div>
            <span className="text-base font-bold text-blue-600">
              {formatPrice(parseFloat(item.price.toString()) * taxMultiplier)}
            </span>
            {taxMultiplier !== 1 && (
              <div className="text-[10px] text-gray-400">
                {formatPrice(item.price)} {t('orders.netPrice')}
              </div>
            )}
          </div>
          {item.preparation_time && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {item.preparation_time} {t('kitchen.min')}
            </span>
          )}
        </div>

        {/* Dietary badges */}
        {(item.is_popular ||
          item.is_vegetarian ||
          item.is_vegan ||
          item.is_gluten_free ||
          item.is_spicy) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.is_popular && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-50 text-yellow-700 rounded-full">
                ⭐ {t('menu.popular')}
              </span>
            )}
            {item.is_vegetarian && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 rounded-full">
                🌱
              </span>
            )}
            {item.is_vegan && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 rounded-full">
                🌿
              </span>
            )}
            {item.is_gluten_free && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded-full">
                🌾
              </span>
            )}
            {item.is_spicy && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 rounded-full">
                🌶️
              </span>
            )}
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-start justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
          {/* Channel toggles: kitchen availability + takeout + delivery */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ChannelToggle
              active={item.is_available}
              activeColor="green"
              label={item.is_available ? t('menu.available') : t('menu.unavailableShort')}
              title={item.is_available ? t('menu.markUnavailable') : t('menu.markAvailable')}
              onClick={() => onToggleAvailability(item.id, item.is_available)}
            />
            <ChannelToggle
              active={item.is_takeoutable}
              activeColor="orange"
              label={t('menu.takeout')}
              title={item.is_takeoutable ? t('menu.markNotTakeoutable') : t('menu.markTakeoutable')}
              onClick={() => onToggleTakeoutable(item.id, item.is_takeoutable)}
            />
            <ChannelToggle
              active={item.is_deliverable}
              activeColor="purple"
              label={t('menu.delivery')}
              title={item.is_deliverable ? t('menu.markNotDeliverable') : t('menu.markDeliverable')}
              onClick={() => onToggleDeliverable(item.id, item.is_deliverable)}
            />
          </div>

          {/* Edit / Delete */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title={t('edit', { ns: 'common' })}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title={t('delete', { ns: 'common' })}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ChannelColor = 'green' | 'orange' | 'purple';

// Tailwind needs the full class strings present in source so the JIT picks
// them up — `bg-${color}-500` won't compile. Lookup table keeps the JSX
// readable while satisfying the JIT.
const TOGGLE_ACTIVE_BG: Record<ChannelColor, string> = {
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
};
const TOGGLE_ACTIVE_TEXT: Record<ChannelColor, string> = {
  green: 'text-green-600',
  orange: 'text-orange-600',
  purple: 'text-purple-600',
};

interface ChannelToggleProps {
  active: boolean;
  activeColor: ChannelColor;
  label: string;
  title: string;
  onClick: () => void;
}

function ChannelToggle({ active, activeColor, label, title, onClick }: ChannelToggleProps) {
  return (
    <button
      type="button"
      // aria-pressed turns this into a toggle button for assistive tech —
      // screen readers announce "Available, toggle button, pressed" vs
      // "Available, toggle button, not pressed", so the visual switch
      // state isn't silently lost. The `title` provides on/off prose for
      // sighted hover but isn't reliably read by screen readers.
      aria-pressed={active}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center gap-1.5 text-xs font-medium transition-colors"
      title={title}
    >
      <div
        className={`relative w-8 h-[18px] rounded-full transition-colors ${
          active ? TOGGLE_ACTIVE_BG[activeColor] : 'bg-gray-300'
        }`}
      >
        <div
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform ${
            active ? 'left-[16px]' : 'left-[2px]'
          }`}
        />
      </div>
      <span className={active ? TOGGLE_ACTIVE_TEXT[activeColor] : 'text-gray-400'}>{label}</span>
    </button>
  );
}

export const MenuItemCard = memo(MenuItemCardImpl);

export function MenuItemSkeletonCard() {
  return (
    <div className="bg-white rounded-xl border overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-5 bg-gray-200 rounded w-1/3 mt-2" />
        <div className="h-px bg-gray-100 mt-3" />
        <div className="flex justify-between mt-2">
          <div className="h-4 bg-gray-100 rounded w-16" />
          <div className="flex gap-1">
            <div className="h-7 w-7 bg-gray-100 rounded-lg" />
            <div className="h-7 w-7 bg-gray-100 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
