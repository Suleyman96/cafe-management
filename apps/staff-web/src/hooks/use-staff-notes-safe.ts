'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

const QUERY_KEYS = {
  STAFF_NOTES: 'staff-notes',
  STAFF_NOTE: 'staff-note',
};

export function useStaffNotes(options?: { includeExpired?: boolean }) {
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF_NOTES, options],
    queryFn: () => db.staffNotes.findAll(options),
  });
}

export function useStaffNote(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF_NOTE, id],
    queryFn: () => db.staffNotes.findById(id),
    enabled: !!id,
  });
}

export function useCreateStaffNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteData: {
      created_by: string;
      title: string;
      content: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      is_pinned?: boolean;
      expires_at?: string | null;
    }) => db.staffNotes.create(noteData as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF_NOTES] });
    },
  });
}

export function useUpdateStaffNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: {
      id: string;
      updates: {
        title?: string;
        content?: string;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        is_pinned?: boolean;
        expires_at?: string | null;
      };
    }) => db.staffNotes.update(id, updates as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF_NOTES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF_NOTE] });
    },
  });
}

export function useDeleteStaffNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.staffNotes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF_NOTES] });
    },
  });
}

export function useToggleStaffNotePin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.staffNotes.togglePin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF_NOTES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF_NOTE] });
    },
  });
}
