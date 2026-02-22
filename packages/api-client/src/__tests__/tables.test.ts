import { beforeEach, describe, expect, it } from 'vitest';
import { createTablesWrapper } from '../wrapper/tables';
import { createMockContext } from './helpers/mock-supabase';

const validTable = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  table_number: 'T01',
  status: 'free',
  capacity: 4,
  qr_code: 'TABLE_001',
  location: 'main',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('TablesWrapper', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let tables: ReturnType<typeof createTablesWrapper>;

  beforeEach(() => {
    ctx = createMockContext({
      responses: {
        tables: { data: [validTable], error: null },
      },
    });
    tables = createTablesWrapper(ctx);
  });

  it('findAll returns tables', async () => {
    const result = await tables.findAll();
    expect(result).toEqual([validTable]);
  });

  it('findById returns single table', async () => {
    const singleCtx = createMockContext({
      responses: {
        tables: { data: validTable, error: null },
      },
    });
    const singleTables = createTablesWrapper(singleCtx);
    const result = await singleTables.findById(validTable.id);
    expect(result).toEqual(validTable);
  });

  it('findByTableNumber finds by number', async () => {
    const ctx = createMockContext({
      responses: {
        tables: { data: validTable, error: null },
      },
    });
    const tables = createTablesWrapper(ctx);
    const result = await tables.findByTableNumber('T01');
    expect(result).toEqual(validTable);
  });

  it('updateStatus updates correctly', async () => {
    const ctx = createMockContext({
      responses: {
        tables: { data: { ...validTable, status: 'occupied' }, error: null },
      },
    });
    const tables = createTablesWrapper(ctx);
    const result = await tables.updateStatus(validTable.id, 'occupied');
    expect(result.status).toBe('occupied');
  });

  it('throws on supabase error', async () => {
    const errorCtx = createMockContext({
      responses: {
        tables: { data: null, error: { status: 404, message: 'not found' } },
      },
    });
    const errorTables = createTablesWrapper(errorCtx);
    await expect(errorTables.findAll()).rejects.toThrow();
  });
});
