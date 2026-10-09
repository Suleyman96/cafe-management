import { AuthenticationError, ConflictError } from '@gustri/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStaffWrapper } from '../wrapper/staff';
import {
  buildStaff,
  buildStaffInsert,
  buildStaffUpdate,
  resetFactoryCounter,
} from './helpers/factories';
import { createMockContext } from './helpers/mock-supabase';

const validStaff = buildStaff({
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'john@cafe.com',
  role: 'waiter',
  full_name: 'John Doe',
  is_active: true,
  auth_user_id: 'auth-123',
});

describe('StaffWrapper', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let staff: ReturnType<typeof createStaffWrapper>;

  beforeEach(() => {
    resetFactoryCounter();
    ctx = createMockContext({
      responses: {
        staff: { data: [validStaff], error: null },
      },
    });
    staff = createStaffWrapper(ctx);
  });

  it('findAll returns staff list', async () => {
    const result = await staff.findAll();
    expect(result).toEqual([validStaff]);
  });

  it('findAll filters by role', async () => {
    await staff.findAll({ role: 'waiter' });
    const calls = ctx.getCalls();
    expect(calls[0].table).toBe('staff');
  });

  it('findById returns single staff member', async () => {
    const singleCtx = createMockContext({
      responses: { staff: { data: validStaff, error: null } },
    });
    const singleStaff = createStaffWrapper(singleCtx);
    const result = await singleStaff.findById(validStaff.id);
    expect(result).toEqual(validStaff);
  });

  it('findByEmail returns staff by email', async () => {
    const emailCtx = createMockContext({
      responses: { staff: { data: validStaff, error: null } },
    });
    const emailStaff = createStaffWrapper(emailCtx);
    const result = await emailStaff.findByEmail('john@cafe.com');
    expect(result).toEqual(validStaff);
  });

  it('findByAuthId returns staff by auth user ID', async () => {
    const authCtx = createMockContext({
      responses: { staff: { data: validStaff, error: null } },
    });
    const authStaff = createStaffWrapper(authCtx);
    const result = await authStaff.findByAuthId('auth-123');
    expect(result).toEqual(validStaff);
  });

  it('create inserts staff member', async () => {
    const createCtx = createMockContext({
      responses: { staff: { data: validStaff, error: null } },
    });
    const createStaff = createStaffWrapper(createCtx);
    const result = await createStaff.create(
      buildStaffInsert({
        email: 'john@cafe.com',
        role: 'waiter',
        full_name: 'John Doe',
      }),
    );
    expect(result).toEqual(validStaff);
    expect(createCtx.getCalls()[0].method).toBe('insert');
  });

  it('update modifies staff member', async () => {
    const updateCtx = createMockContext({
      responses: { staff: { data: { ...validStaff, role: 'admin' }, error: null } },
    });
    const updateStaff = createStaffWrapper(updateCtx);
    const result = await updateStaff.update(validStaff.id, buildStaffUpdate({ role: 'admin' }));
    expect(result.role).toBe('admin');
    expect(updateCtx.getCalls()[0].method).toBe('update');
  });

  it('delete removes staff member', async () => {
    const deleteCtx = createMockContext({
      responses: { staff: { data: null, error: null } },
    });
    const deleteStaff = createStaffWrapper(deleteCtx);
    await deleteStaff.delete(validStaff.id);
    expect(deleteCtx.getCalls()[0].method).toBe('update');
  });

  it('getActiveWaiters returns active waiters', async () => {
    const waiterCtx = createMockContext({
      responses: { staff: { data: [validStaff], error: null } },
    });
    const waiterStaff = createStaffWrapper(waiterCtx);
    const result = await waiterStaff.getActiveWaiters();
    expect(result).toEqual([validStaff]);
  });

  it('updateLastLogin updates the last_login_at field', async () => {
    const loginCtx = createMockContext({
      responses: { staff: { data: null, error: null } },
    });
    const loginStaff = createStaffWrapper(loginCtx);
    await loginStaff.updateLastLogin(validStaff.id);
    const calls = loginCtx.getCalls();
    expect(calls[0].table).toBe('staff');
    expect(calls[0].method).toBe('update');
  });

  it('throws on supabase error', async () => {
    const errorCtx = createMockContext({
      responses: { staff: { data: null, error: { code: '23505', message: 'duplicate' } } },
    });
    const errorStaff = createStaffWrapper(errorCtx);
    await expect(errorStaff.findAll()).rejects.toThrow();
  });

  it('findById throws when data fails isStaff guard', async () => {
    const ctx = createMockContext({
      responses: { staff: { data: { id: '1' }, error: null } },
    });
    const wrapper = createStaffWrapper(ctx);
    await expect(wrapper.findById('1')).rejects.toThrow('Invalid staff data');
  });

  it('findAll returns empty array when data is null', async () => {
    const ctx = createMockContext({
      responses: { staff: { data: null, error: null } },
    });
    const wrapper = createStaffWrapper(ctx);
    const result = await wrapper.findAll();
    expect(result).toEqual([]);
  });

  it('throws ConflictError for duplicate key', async () => {
    const ctx = createMockContext({
      responses: { staff: { data: null, error: { code: '23505', message: 'duplicate' } } },
    });
    const wrapper = createStaffWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow(ConflictError);
  });

  it('throws AuthenticationError for PGRST301 code', async () => {
    const ctx = createMockContext({
      responses: { staff: { data: null, error: { code: 'PGRST301', message: 'JWT expired' } } },
    });
    const wrapper = createStaffWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow(AuthenticationError);
  });

  it('findByAuthId queries with auth_user_id and is_active filter', async () => {
    const inactiveStaff = { ...validStaff, is_active: false };
    const ctx = createMockContext({
      responses: { staff: { data: inactiveStaff, error: null } },
    });
    const wrapper = createStaffWrapper(ctx);
    const result = await wrapper.findByAuthId('auth-123');
    expect(result).toEqual(inactiveStaff);
    const calls = ctx.getCalls();
    expect(calls[0].table).toBe('staff');
    expect(calls[0].method).toBe('select');
  });

  it('findByEmail throws when data fails isStaff guard', async () => {
    const ctx = createMockContext({
      responses: { staff: { data: { id: '1' }, error: null } },
    });
    const wrapper = createStaffWrapper(ctx);
    await expect(wrapper.findByEmail('test@cafe.com')).rejects.toThrow('Invalid staff data');
  });

  it('findByAuthId throws when data fails isStaff guard', async () => {
    const ctx = createMockContext({
      responses: { staff: { data: { id: '1' }, error: null } },
    });
    const wrapper = createStaffWrapper(ctx);
    await expect(wrapper.findByAuthId('auth-999')).rejects.toThrow('Invalid staff data');
  });

  it('create throws ConflictError for duplicate key', async () => {
    const ctx = createMockContext({
      responses: { staff: { data: null, error: { code: '23505', message: 'duplicate email' } } },
    });
    const wrapper = createStaffWrapper(ctx);
    await expect(
      wrapper.create(
        buildStaffInsert({ email: 'john@cafe.com', role: 'waiter', full_name: 'John' }),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('findAll throws when data fails isStaffArray guard', async () => {
    const ctx = createMockContext({
      responses: { staff: { data: [{ id: '1' }], error: null } },
    });
    const wrapper = createStaffWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow('Invalid staff data');
  });

  // ─── M6: tenant predicate + mass-assignment allow-list ───────────

  const TENANT = '00000000-0000-0000-0000-00000000aaaa';

  it('update scopes the write to the bound tenant (eq tenant_id)', async () => {
    const ctx = createMockContext({
      tenantId: TENANT,
      responses: { staff: { data: validStaff, error: null } },
    });
    const wrapper = createStaffWrapper(ctx);
    await wrapper.update(validStaff.id, buildStaffUpdate({ full_name: 'New Name' }));
    const eqCalls = ctx
      .getCalls()
      .filter((c: { method: string; args: unknown[] }) => c.method === 'eq');
    expect(
      eqCalls.some((c: { args: unknown[] }) => c.args[0] === 'tenant_id' && c.args[1] === TENANT),
    ).toBe(true);
  });

  it('update strips non-allow-listed columns (tenant_id, auth_user_id, pin_hash, id)', async () => {
    const ctx = createMockContext({
      tenantId: TENANT,
      responses: { staff: { data: validStaff, error: null } },
    });
    const wrapper = createStaffWrapper(ctx);
    await wrapper.update(validStaff.id, {
      full_name: 'Edited',
      role: 'admin',
      // Mass-assignment attempt — these must NOT reach the update payload.
      tenant_id: 'another-tenant',
      auth_user_id: 'hijack-auth',
      pin_hash: 'injected-hash',
      id: 'spoofed-id',
    } as never);
    const updateCall = ctx
      .getCalls()
      .find((c: { table: string; method: string }) => c.table === 'staff' && c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload).toBeDefined();
    expect(payload).not.toHaveProperty('tenant_id');
    expect(payload).not.toHaveProperty('auth_user_id');
    expect(payload).not.toHaveProperty('pin_hash');
    expect(payload).not.toHaveProperty('id');
    // Allow-listed columns still pass through.
    expect(payload.full_name).toBe('Edited');
    expect(payload.role).toBe('admin');
  });

  it('delete scopes the soft-delete to the bound tenant (eq tenant_id)', async () => {
    const ctx = createMockContext({
      tenantId: TENANT,
      responses: { staff: { data: null, error: null } },
    });
    const wrapper = createStaffWrapper(ctx);
    await wrapper.delete(validStaff.id);
    const eqCalls = ctx
      .getCalls()
      .filter((c: { method: string; args: unknown[] }) => c.method === 'eq');
    expect(
      eqCalls.some((c: { args: unknown[] }) => c.args[0] === 'tenant_id' && c.args[1] === TENANT),
    ).toBe(true);
  });

  it('findAll requests an explicit projection without auth_user_id', async () => {
    const listRow = {
      id: 'list-1',
      email: 'l@cafe.com',
      full_name: 'Lister',
      role: 'waiter',
      is_active: true,
      created_at: '2026-05-03T00:00:00Z',
      updated_at: '2026-05-03T00:00:00Z',
    };
    const listCtx = createMockContext({
      responses: { staff: { data: [listRow], error: null } },
    });
    const listStaff = createStaffWrapper(listCtx);
    const result = await listStaff.findAll();

    // The wrapper must request a literal column list — never `*` — and the
    // returned row must omit `auth_user_id` so we don't leak it to clients.
    const selectArgs = listCtx
      .getCalls()
      .filter(
        (c: { table: string; method: string }) => c.table === 'staff' && c.method === 'select',
      )
      .map((c: { args: unknown[] }) => c.args[0] as string);
    expect(selectArgs.length).toBeGreaterThan(0);
    for (const arg of selectArgs) {
      expect(arg).not.toBe('*');
      expect(arg).not.toMatch(/auth_user_id/);
    }
    expect(result[0]).not.toHaveProperty('auth_user_id');
  });
});
