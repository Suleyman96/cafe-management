'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { Edit3, Minus, Plus, Trash2 } from 'lucide-react';

interface CartItemCardProps {
  item: {
    menuItem: { id: string; name: string; price: number };
    quantity: number;
    notes?: string;
    lineKey: string;
    selectedOptions?: Array<{ valueName: string; priceDelta: number }>;
  };
  taxMultiplier: number;
  allowItemNotes: boolean;
  editingNotes: string | null;
  tempNotes: Record<string, string>;
  onEditNotes: (itemId: string, currentNotes: string) => void;
  onCancelEditNotes: (itemId: string) => void;
  onSaveNotes: (itemId: string, notes: string) => void;
  onTempNotesChange: (itemId: string, value: string) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  formatPrice: (amount: number) => string;
  priceLabel: string;
}

export function CartItemCard({
  item,
  taxMultiplier,
  allowItemNotes,
  editingNotes,
  tempNotes,
  onEditNotes,
  onCancelEditNotes,
  onSaveNotes,
  onTempNotesChange,
  onRemoveItem,
  onUpdateQuantity,
  formatPrice,
  priceLabel,
}: CartItemCardProps) {
  const { t } = useTranslation('customer');
  const isEditingThisItem = editingNotes === item.lineKey;
  const unitPrice =
    item.menuItem.price + (item.selectedOptions ?? []).reduce((sum, o) => sum + o.priceDelta, 0);

  return (
    <div className="bg-card rounded-lg p-4 border">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold">{item.menuItem.name}</h3>
          <p className="text-sm text-muted-foreground">{priceLabel}</p>
          {item.selectedOptions && item.selectedOptions.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.selectedOptions.map((o) => o.valueName).join(', ')}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemoveItem(item.lineKey)}
          className="text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Item Notes Section */}
      {allowItemNotes && (
        <div className="mb-3">
          {!isEditingThisItem ? (
            <div>
              {item.notes ? (
                <div className="flex items-start gap-2 p-2 bg-muted rounded-md">
                  <span className="text-sm">{item.notes}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-auto"
                    onClick={() => onEditNotes(item.lineKey, item.notes || '')}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => onEditNotes(item.lineKey, '')}
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  {t('cart.addSpecialNotes')}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full min-h-[60px] p-2 text-sm rounded-md border border-input bg-background"
                placeholder={t('cart.notesPlaceholder')}
                value={tempNotes[item.lineKey] || ''}
                onChange={(e) => onTempNotesChange(item.lineKey, e.target.value)}
                maxLength={200}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onCancelEditNotes(item.lineKey)}
                >
                  {t('cancel', { ns: 'common' })}
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => onSaveNotes(item.lineKey, tempNotes[item.lineKey] || '')}
                >
                  {t('save', { ns: 'common' })}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateQuantity(item.lineKey, item.quantity - 1)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="font-bold w-8 text-center">{item.quantity}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateQuantity(item.lineKey, item.quantity + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <span className="font-bold text-lg">
          {formatPrice(unitPrice * item.quantity * taxMultiplier)}
        </span>
      </div>
    </div>
  );
}
