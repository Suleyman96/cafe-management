import { ConflictError, NotFoundError, ValidationError } from '@cafe-idare/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCategoriesWrapper, createMenuItemsWrapper } from '../wrapper/menu';
import { createMockContext } from './helpers/mock-supabase';

const validMenuItem = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Pizza Margherita',
  price: 15.99,
  category_id: '123e4567-e89b-12d3-a456-426614174001',
  is_available: true,
};

const validCategory = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Main Dishes',
  display_order: 1,
  is_active: true,
};

describe('MenuItemsWrapper', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let menuItems: ReturnType<typeof createMenuItemsWrapper>;

  beforeEach(() => {
    ctx = createMockContext({
      responses: {
        menu_items: { data: [validMenuItem], error: null },
      },
    });
    menuItems = createMenuItemsWrapper(ctx);
  });

  it('findAll returns menu items', async () => {
    const result = await menuItems.findAll();
    expect(result).toEqual([validMenuItem]);
  });

  it('findAll applies categoryId filter', async () => {
    await menuItems.findAll({ categoryId: validCategory.id });
    const calls = ctx.getCalls();
    expect(calls[0].table).toBe('menu_items');
  });

  it('findAll applies isAvailable filter', async () => {
    await menuItems.findAll({ isAvailable: true });
    const calls = ctx.getCalls();
    expect(calls[0].table).toBe('menu_items');
  });

  it('findAll applies isPopular filter', async () => {
    await menuItems.findAll({ isPopular: true });
    const calls = ctx.getCalls();
    expect(calls[0].table).toBe('menu_items');
  });

  it('findById returns single item', async () => {
    const singleCtx = createMockContext({
      responses: {
        menu_items: { data: validMenuItem, error: null },
      },
    });
    const items = createMenuItemsWrapper(singleCtx);
    const result = await items.findById(validMenuItem.id);
    expect(result).toEqual(validMenuItem);
  });

  it('create inserts menu item', async () => {
    const createCtx = createMockContext({
      responses: {
        menu_items: { data: validMenuItem, error: null },
      },
    });
    const items = createMenuItemsWrapper(createCtx);
    const result = await items.create({
      name: 'Pizza',
      price: 15.99,
      category_id: validCategory.id,
    } as any);
    expect(result).toEqual(validMenuItem);
    expect(createCtx.getCalls()[0].method).toBe('insert');
  });

  it('update modifies menu item', async () => {
    const updateCtx = createMockContext({
      responses: {
        menu_items: { data: { ...validMenuItem, price: 18.99 }, error: null },
      },
    });
    const items = createMenuItemsWrapper(updateCtx);
    const result = await items.update(validMenuItem.id, { price: 18.99 });
    expect(result.price).toBe(18.99);
    expect(updateCtx.getCalls()[0].method).toBe('update');
  });

  it('toggleAvailability toggles is_available', async () => {
    const toggleCtx = createMockContext({
      responses: {
        menu_items: { data: { ...validMenuItem, is_available: false }, error: null },
      },
    });
    const items = createMenuItemsWrapper(toggleCtx);
    const result = await items.toggleAvailability(validMenuItem.id);
    expect(result.is_available).toBe(false);
  });

  it('delete removes menu item', async () => {
    const deleteCtx = createMockContext({
      responses: {
        menu_items: { data: null, error: null },
      },
    });
    const items = createMenuItemsWrapper(deleteCtx);
    await items.delete(validMenuItem.id);
    expect(deleteCtx.getCalls()[0].method).toBe('delete');
  });

  it('throws on supabase error', async () => {
    const errorCtx = createMockContext({
      responses: {
        menu_items: { data: null, error: { code: '23503', message: 'fk violation' } },
      },
    });
    const items = createMenuItemsWrapper(errorCtx);
    await expect(items.findAll()).rejects.toThrow();
  });

  it('findById throws when data fails isMenuItem guard', async () => {
    const ctx = createMockContext({
      responses: { menu_items: { data: { id: '1' }, error: null } },
    });
    const wrapper = createMenuItemsWrapper(ctx);
    await expect(wrapper.findById('1')).rejects.toThrow('Invalid menu item data');
  });

  it('findAll returns empty array when data is null', async () => {
    const ctx = createMockContext({
      responses: { menu_items: { data: null, error: null } },
    });
    const wrapper = createMenuItemsWrapper(ctx);
    const result = await wrapper.findAll();
    expect(result).toEqual([]);
  });

  it('throws ConflictError for duplicate key on findAll', async () => {
    const ctx = createMockContext({
      responses: { menu_items: { data: null, error: { code: '23505', message: 'duplicate' } } },
    });
    const wrapper = createMenuItemsWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow(ConflictError);
  });

  it('throws ValidationError for foreign key violation', async () => {
    const ctx = createMockContext({
      responses: {
        menu_items: { data: null, error: { code: '23503', message: 'fk violation' } },
      },
    });
    const wrapper = createMenuItemsWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow(ValidationError);
  });

  it('throws ConflictError for duplicate key on create', async () => {
    const ctx = createMockContext({
      responses: { menu_items: { data: null, error: { code: '23505', message: 'duplicate' } } },
    });
    const wrapper = createMenuItemsWrapper(ctx);
    await expect(
      wrapper.create({ name: 'Pizza', price: 10, category_id: 'cat-1' } as any),
    ).rejects.toThrow(ConflictError);
  });

  it('create throws when data fails isMenuItem guard', async () => {
    const ctx = createMockContext({
      responses: { menu_items: { data: { id: '1' }, error: null } },
    });
    const wrapper = createMenuItemsWrapper(ctx);
    await expect(
      wrapper.create({ name: 'Pizza', price: 10, category_id: 'cat-1' } as any),
    ).rejects.toThrow('Invalid menu item data');
  });

  it('update throws when data fails isMenuItem guard', async () => {
    const ctx = createMockContext({
      responses: { menu_items: { data: { id: '1' }, error: null } },
    });
    const wrapper = createMenuItemsWrapper(ctx);
    await expect(wrapper.update('1', { price: 20 })).rejects.toThrow('Invalid menu item data');
  });
});

describe('CategoriesWrapper', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let categories: ReturnType<typeof createCategoriesWrapper>;

  beforeEach(() => {
    ctx = createMockContext({
      responses: {
        categories: { data: [validCategory], error: null },
      },
    });
    categories = createCategoriesWrapper(ctx);
  });

  it('findAll returns categories', async () => {
    const result = await categories.findAll();
    expect(result).toEqual([validCategory]);
  });

  it('findAll applies isActive filter', async () => {
    await categories.findAll({ isActive: true });
    const calls = ctx.getCalls();
    expect(calls[0].table).toBe('categories');
  });

  it('create inserts category', async () => {
    const createCtx = createMockContext({
      responses: {
        categories: { data: validCategory, error: null },
      },
    });
    const cats = createCategoriesWrapper(createCtx);
    const result = await cats.create({ name: 'Main Dishes' } as any);
    expect(result).toEqual(validCategory);
    expect(createCtx.getCalls()[0].method).toBe('insert');
  });

  it('update modifies category', async () => {
    const updateCtx = createMockContext({
      responses: {
        categories: { data: { ...validCategory, name: 'Appetizers' }, error: null },
      },
    });
    const cats = createCategoriesWrapper(updateCtx);
    const result = await cats.update(validCategory.id, { name: 'Appetizers' });
    expect(result.name).toBe('Appetizers');
  });

  it('delete removes category', async () => {
    const deleteCtx = createMockContext({
      responses: {
        categories: { data: null, error: null },
      },
    });
    const cats = createCategoriesWrapper(deleteCtx);
    await cats.delete(validCategory.id);
    expect(deleteCtx.getCalls()[0].method).toBe('delete');
  });

  it('throws on supabase error', async () => {
    const errorCtx = createMockContext({
      responses: {
        categories: { data: null, error: { status: 404, message: 'not found' } },
      },
    });
    const cats = createCategoriesWrapper(errorCtx);
    await expect(cats.findAll()).rejects.toThrow();
  });

  it('findAll returns empty array when data is null', async () => {
    const ctx = createMockContext({
      responses: { categories: { data: null, error: null } },
    });
    const cats = createCategoriesWrapper(ctx);
    const result = await cats.findAll();
    expect(result).toEqual([]);
  });

  it('throws ConflictError for duplicate key on create', async () => {
    const ctx = createMockContext({
      responses: { categories: { data: null, error: { code: '23505', message: 'duplicate' } } },
    });
    const cats = createCategoriesWrapper(ctx);
    await expect(cats.create({ name: 'Drinks' } as any)).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError for 404 status on findAll', async () => {
    const ctx = createMockContext({
      responses: { categories: { data: null, error: { status: 404, message: 'not found' } } },
    });
    const cats = createCategoriesWrapper(ctx);
    await expect(cats.findAll()).rejects.toThrow(NotFoundError);
  });

  it('create throws when data fails isCategory guard', async () => {
    const ctx = createMockContext({
      responses: { categories: { data: { id: '1', no_name: true }, error: null } },
    });
    const cats = createCategoriesWrapper(ctx);
    await expect(cats.create({ name: 'Drinks' } as any)).rejects.toThrow('Invalid category data');
  });

  it('update throws when data fails isCategory guard', async () => {
    const ctx = createMockContext({
      responses: { categories: { data: { no_id: true }, error: null } },
    });
    const cats = createCategoriesWrapper(ctx);
    await expect(cats.update('1', { name: 'Appetizers' })).rejects.toThrow('Invalid category data');
  });

  it('findAll throws when data fails isCategoryArray guard', async () => {
    const ctx = createMockContext({
      responses: { categories: { data: [{ id: '1' }], error: null } },
    });
    const cats = createCategoriesWrapper(ctx);
    await expect(cats.findAll()).rejects.toThrow('Invalid categories data');
  });
});
