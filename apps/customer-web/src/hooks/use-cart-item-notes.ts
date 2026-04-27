import { useCallback, useState } from 'react';
import { useCartStore } from '@/store/cart-store';

export function useCartItemNotes() {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({});
  const updateNotes = useCartStore((s) => s.updateNotes);

  const onEditNotes = useCallback((id: string, notes: string) => {
    setEditingNotes(id);
    setTempNotes((prev) => ({ ...prev, [id]: notes }));
  }, []);

  const onCancelEditNotes = useCallback((id: string) => {
    setEditingNotes(null);
    setTempNotes((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const onSaveNotes = useCallback(
    (id: string, notes: string) => {
      updateNotes(id, notes);
      setEditingNotes(null);
      setTempNotes((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    },
    [updateNotes],
  );

  const onTempNotesChange = useCallback((id: string, value: string) => {
    setTempNotes((prev) => ({ ...prev, [id]: value }));
  }, []);

  return {
    editingNotes,
    tempNotes,
    onEditNotes,
    onCancelEditNotes,
    onSaveNotes,
    onTempNotesChange,
  };
}
