'use client';

import type { SupabaseWrapper } from '@gustri/api-client';
import { createContext, useContext } from 'react';

const DbContext = createContext<SupabaseWrapper | null>(null);

export function DbProvider({ db, children }: { db: SupabaseWrapper; children: React.ReactNode }) {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): SupabaseWrapper {
  const db = useContext(DbContext);
  if (!db) {
    throw new Error(
      'useDb must be used within a <DbProvider>. Wrap your app in <DbProvider db={db}>.',
    );
  }
  return db;
}
