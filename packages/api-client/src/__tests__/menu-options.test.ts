import { beforeEach, describe, expect, it } from 'vitest';
import { createMenuItemOptionsWrapper } from '../wrapper/menu-options';
import { createMockContext } from './helpers/mock-supabase';

const TENANT = '11111111-1111-1111-1111-111111111111';
const MENU_ITEM = '22222222-2222-2222-2222-222222222222';
const OPTION = '33333333-3333-3333-3333-333333333333';

const sampleOption = {
  id: OPTION,
  tenant_id: TENANT,
  menu_item_id: MENU_ITEM,
  name: 'Size',
  selection_type: 'single',
  is_required: true,
  min_select: 1,
  max_select: 1,
  display_order: 0,
  is_available: true,
  created_at: '2026-06-04T00:00:00Z',
  updated_at: '2026-06-04T00:00:00Z',
  values: [],
};

describe('MenuItemOptionsWrapper', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let wrapper: ReturnType<typeof createMenuItemOptionsWrapper>;

  beforeEach(() => {
    ctx = createMockContext({
      tenantId: TENANT,
      responses: {
        menu_item_options: { data: [sampleOption], error: null },
        menu_item_option_values: { data: [], error: null },
      },
    });
    wrapper = createMenuItemOptionsWrapper(ctx);
  });

  it('findByMenuItem queries menu_item_options and returns groups with values', async () => {
    const result = await wrapper.findByMenuItem(MENU_ITEM);
    expect(result).toEqual([sampleOption]);
    expect(ctx.getCalls()[0].table).toBe('menu_item_options');
  });

  it('createOption inserts into menu_item_options', async () => {
    ctx = createMockContext({
      tenantId: TENANT,
      responses: { menu_item_options: { data: sampleOption, error: null } },
    });
    wrapper = createMenuItemOptionsWrapper(ctx);
    const created = await wrapper.createOption({
      tenant_id: TENANT,
      menu_item_id: MENU_ITEM,
      name: 'Size',
      selection_type: 'single',
      is_required: true,
    });
    expect(created).toEqual(sampleOption);
    expect(ctx.getCalls()[0].table).toBe('menu_item_options');
  });

  it('createOption rejects a tenant mismatch (defense-in-depth)', async () => {
    await expect(
      wrapper.createOption({
        tenant_id: '99999999-9999-9999-9999-999999999999',
        menu_item_id: MENU_ITEM,
        name: 'Size',
      }),
    ).rejects.toThrow();
  });

  it('createValue inserts into menu_item_option_values', async () => {
    ctx = createMockContext({
      tenantId: TENANT,
      responses: {
        menu_item_option_values: {
          data: {
            id: '44444444-4444-4444-4444-444444444444',
            tenant_id: TENANT,
            option_id: OPTION,
            name: 'Large',
            price_delta: 2,
          },
          error: null,
        },
      },
    });
    wrapper = createMenuItemOptionsWrapper(ctx);
    const created = await wrapper.createValue({
      tenant_id: TENANT,
      option_id: OPTION,
      name: 'Large',
      price_delta: 2,
    });
    expect(created.name).toBe('Large');
    expect(ctx.getCalls()[0].table).toBe('menu_item_option_values');
  });

  it('deleteOption issues a delete on menu_item_options', async () => {
    await wrapper.deleteOption(OPTION);
    expect(ctx.getCalls()[0].table).toBe('menu_item_options');
  });
});
