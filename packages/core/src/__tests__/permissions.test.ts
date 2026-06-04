import { describe, expect, it } from 'vitest';
import { type Action, canPerform } from '../permissions';

describe('canPerform', () => {
  it('rejects null/undefined role for every action', () => {
    const actions: Action[] = [
      'edit_menu',
      'apply_discount',
      'mark_item_ready',
      'grant_owner_role',
    ];
    for (const action of actions) {
      expect(canPerform(null, action)).toBe(false);
      expect(canPerform(undefined, action)).toBe(false);
    }
  });

  describe('admin/owner gates', () => {
    const adminOwnerActions: Action[] = [
      'edit_menu',
      'apply_discount',
      'issue_refund',
      'assign_waiter',
      'edit_settings',
      'manage_staff',
      'manage_tables',
      'manage_tasks',
      'manage_stock',
      'manage_expenses',
    ];

    it.each(adminOwnerActions)('allows admin and owner for %s', (action) => {
      expect(canPerform('admin', action)).toBe(true);
      expect(canPerform('owner', action)).toBe(true);
    });

    it.each(adminOwnerActions)('rejects waiter and kitchen for %s', (action) => {
      expect(canPerform('waiter', action)).toBe(false);
      expect(canPerform('kitchen', action)).toBe(false);
    });
  });

  describe('mark_item_ready', () => {
    it('allows kitchen, admin, owner', () => {
      expect(canPerform('kitchen', 'mark_item_ready')).toBe(true);
      expect(canPerform('admin', 'mark_item_ready')).toBe(true);
      expect(canPerform('owner', 'mark_item_ready')).toBe(true);
    });

    it('rejects waiter', () => {
      expect(canPerform('waiter', 'mark_item_ready')).toBe(false);
    });
  });

  describe('owner-only gates', () => {
    const ownerOnlyActions: Action[] = ['view_reports', 'grant_owner_role'];

    it.each(ownerOnlyActions)('allows owner only for %s', (action) => {
      expect(canPerform('owner', action)).toBe(true);
    });

    it.each(ownerOnlyActions)('rejects admin, kitchen, waiter for %s', (action) => {
      expect(canPerform('admin', action)).toBe(false);
      expect(canPerform('kitchen', action)).toBe(false);
      expect(canPerform('waiter', action)).toBe(false);
    });
  });
});
