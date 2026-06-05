/**
 * Integration test — soft-delete for catalog tables (menu_items, categories).
 *
 * Migration 20260605000001 adds `deleted_at` and a RESTRICTIVE `FOR SELECT`
 * policy (`deleted_at IS NULL`) to both tables. This test drives the real RLS:
 * a tombstoned row must disappear from EVERY reader — anonymous catalog browse
 * AND the authenticated tenant admin who deleted it — while the row itself is
 * retained (visible to a service-role client that bypasses RLS).
 *
 * Run: pnpm test:rls
 * Prerequisites: local Supabase running, db reset & seeded, admin@test.com.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const TENANT_1 = '00000000-0000-0000-0000-000000000001';

let svc: SupabaseClient;
let adminClient: SupabaseClient;
const createdMenuItemIds: string[] = [];
const createdCategoryIds: string[] = [];

beforeAll(async () => {
  svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data, error } = await createClient(SUPABASE_URL, ANON_KEY).auth.signInWithPassword({
    email: 'admin@test.com',
    password: 'test1234',
  });
  if (error || !data.session) {
    throw new Error(`Admin sign-in failed: ${error?.message ?? 'no session'}`);
  }
  adminClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
});

afterAll(async () => {
  // Hard-delete the test rows via service role (bypasses RLS) so the suite
  // leaves no residue.
  if (createdMenuItemIds.length) await svc.from('menu_items').delete().in('id', createdMenuItemIds);
  if (createdCategoryIds.length) await svc.from('categories').delete().in('id', createdCategoryIds);
});

async function seedMenuItem(name: string): Promise<string> {
  const { data, error } = await svc
    .from('menu_items')
    .insert({ tenant_id: TENANT_1, name, price: 10 })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Seed menu_item failed: ${error?.message ?? 'no data'}`);
  createdMenuItemIds.push(data.id);
  return data.id;
}

async function seedCategory(name: string): Promise<string> {
  const { data, error } = await svc
    .from('categories')
    .insert({ tenant_id: TENANT_1, name })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Seed category failed: ${error?.message ?? 'no data'}`);
  createdCategoryIds.push(data.id);
  return data.id;
}

describe('soft-delete RLS — menu_items', () => {
  test('a tombstoned item is hidden from anon + authenticated readers but retained', async () => {
    const id = await seedMenuItem(`SoftDelProbe ${Date.now()}`);

    // Live: visible to anon catalog browse and authenticated admin.
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    expect(
      (await anon.from('menu_items').select('id').eq('id', id).maybeSingle()).data,
    ).toBeTruthy();
    expect(
      (await adminClient.from('menu_items').select('id').eq('id', id).maybeSingle()).data,
    ).toBeTruthy();

    // Soft-delete via the SECURITY DEFINER RPC (the path the wrapper uses). A
    // direct client UPDATE can't set deleted_at — the restrictive SELECT policy
    // is enforced against the new row.
    const { error: delErr } = await adminClient.rpc('soft_delete_menu_item', { p_id: id });
    expect(delErr).toBeNull();

    // Hidden from anon browse.
    expect((await anon.from('menu_items').select('id').eq('id', id).maybeSingle()).data).toBeNull();
    // Hidden from the authenticated admin who deleted it (restrictive policy
    // AND-s with tenant_isolation, so same-tenant staff don't see it either).
    expect(
      (await adminClient.from('menu_items').select('id').eq('id', id).maybeSingle()).data,
    ).toBeNull();
    // Retained: service role bypasses RLS and still sees the tombstoned row.
    const svcRow = (await svc.from('menu_items').select('id, deleted_at').eq('id', id).single())
      .data as { id: string; deleted_at: string | null };
    expect(svcRow.id).toBe(id);
    expect(svcRow.deleted_at).not.toBeNull();
  });

  test('re-creating a same-named item after soft-delete works (no unique collision)', async () => {
    const name = `ReuseName ${Date.now()}`;
    const first = await seedMenuItem(name);
    await adminClient.rpc('soft_delete_menu_item', { p_id: first });

    // A second live row with the same name must be insertable + visible.
    const second = await seedMenuItem(name);
    expect(
      (await adminClient.from('menu_items').select('id').eq('id', second).maybeSingle()).data,
    ).toBeTruthy();
  });
});

describe('soft-delete RLS — categories', () => {
  test('a tombstoned category is hidden from readers but retained', async () => {
    const id = await seedCategory(`CatProbe ${Date.now()}`);
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    expect(
      (await anon.from('categories').select('id').eq('id', id).maybeSingle()).data,
    ).toBeTruthy();

    const { error } = await adminClient.rpc('soft_delete_category', { p_id: id });
    expect(error).toBeNull();

    expect((await anon.from('categories').select('id').eq('id', id).maybeSingle()).data).toBeNull();
    expect(
      (await adminClient.from('categories').select('id').eq('id', id).maybeSingle()).data,
    ).toBeNull();
    expect((await svc.from('categories').select('id').eq('id', id).single()).data).toBeTruthy();
  });
});
