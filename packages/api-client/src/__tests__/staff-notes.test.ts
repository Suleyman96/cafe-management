import { describe, expect, it } from 'vitest';
import { createStaffNotesWrapper } from '../wrapper/staff-notes';
import { createMockContext } from './helpers/mock-supabase';

const validNote = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Shift reminder',
  content: 'Check fridge temperatures',
  created_by: '123e4567-e89b-12d3-a456-426614174001',
  is_pinned: false,
  expires_at: null,
  created_at: new Date().toISOString(),
};

describe('StaffNotesWrapper', () => {
  it('findAll returns notes', async () => {
    const ctx = createMockContext({
      responses: {
        staff_notes: { data: [validNote], error: null },
      },
    });
    const notes = createStaffNotesWrapper(ctx);
    const result = await notes.findAll();
    expect(result).toEqual([validNote]);
  });

  it('findAll can include expired notes', async () => {
    const ctx = createMockContext({
      responses: {
        staff_notes: { data: [validNote], error: null },
      },
    });
    const notes = createStaffNotesWrapper(ctx);
    const result = await notes.findAll({ includeExpired: true });
    expect(result).toEqual([validNote]);
  });

  it('findAll returns empty when no data', async () => {
    const ctx = createMockContext({
      responses: {
        staff_notes: { data: null, error: null },
      },
    });
    const notes = createStaffNotesWrapper(ctx);
    const result = await notes.findAll();
    expect(result).toEqual([]);
  });

  it('findById returns single note', async () => {
    const ctx = createMockContext({
      responses: {
        staff_notes: { data: validNote, error: null },
      },
    });
    const notes = createStaffNotesWrapper(ctx);
    const result = await notes.findById(validNote.id);
    expect(result).toEqual(validNote);
  });

  it('create inserts note', async () => {
    const ctx = createMockContext({
      responses: {
        staff_notes: { data: validNote, error: null },
      },
    });
    const notes = createStaffNotesWrapper(ctx);
    const result = await notes.create({
      title: 'Shift reminder',
      content: 'Check fridge temperatures',
      created_by: validNote.created_by,
    } as any);
    expect(result).toEqual(validNote);
    expect(ctx.getCalls()[0].method).toBe('insert');
  });

  it('update modifies note', async () => {
    const updatedNote = { ...validNote, content: 'Updated content' };
    const ctx = createMockContext({
      responses: {
        staff_notes: { data: updatedNote, error: null },
      },
    });
    const notes = createStaffNotesWrapper(ctx);
    const result = await notes.update(validNote.id, { content: 'Updated content' } as any);
    expect(result.content).toBe('Updated content');
    expect(ctx.getCalls()[0].method).toBe('update');
  });

  it('delete removes note', async () => {
    const ctx = createMockContext({
      responses: {
        staff_notes: { data: null, error: null },
      },
    });
    const notes = createStaffNotesWrapper(ctx);
    await notes.delete(validNote.id);
    expect(ctx.getCalls()[0].method).toBe('delete');
  });

  it('togglePin toggles is_pinned state', async () => {
    const pinnedNote = { ...validNote, is_pinned: true };
    const ctx = createMockContext({
      responses: {
        staff_notes: { data: pinnedNote, error: null },
      },
    });
    const notes = createStaffNotesWrapper(ctx);
    const result = await notes.togglePin(validNote.id);
    expect(result.is_pinned).toBe(true);
  });

  it('throws on supabase error', async () => {
    const ctx = createMockContext({
      responses: {
        staff_notes: { data: null, error: { status: 401 } },
      },
    });
    const notes = createStaffNotesWrapper(ctx);
    await expect(notes.findAll()).rejects.toThrow();
  });
});
