// Personal items database using IndexedDB
import type { PersonalItem } from '../types';
import { STORES, dbDelete, dbGetAll, dbPut, initDB, syncWithRetry } from './indexedDBCore';

// Ensure DB is initialized
initDB();

export const addPersonalItem = async (
  item: Omit<PersonalItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PersonalItem> => {
  const newItem: PersonalItem = {
    ...item,
    id: `item-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as PersonalItem;

  await dbPut(STORES.PERSONAL_ITEMS, newItem);

  syncWithRetry(async () => {
    const { isSupabaseConfigured, supabase } = await import('../lib/supabase');
    if (isSupabaseConfigured()) {
      await supabase.from('personal_items').upsert(newItem);
    }
  }, `personal_item_add_${newItem.id}`);

  return newItem;
};

export const getPersonalItems = async (): Promise<PersonalItem[]> => {
  return dbGetAll<PersonalItem>(STORES.PERSONAL_ITEMS);
};

export const updatePersonalItem = async (
  id: string,
  updates: Partial<PersonalItem>
): Promise<void> => {
  const items = await dbGetAll<PersonalItem>(STORES.PERSONAL_ITEMS);
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) return;

  const existing = items[index];
  if (!existing) return;

  const updatedItem: PersonalItem = {
    ...existing,
    ...updates,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  await dbPut(STORES.PERSONAL_ITEMS, updatedItem);

  syncWithRetry(async () => {
    const { isSupabaseConfigured, supabase } = await import('../lib/supabase');
    if (isSupabaseConfigured()) {
      await supabase.from('personal_items').upsert(updatedItem);
    }
  }, `personal_item_update_${id}`);
};

export const removePersonalItem = async (id: string): Promise<void> => {
  await dbDelete(STORES.PERSONAL_ITEMS, id);

  syncWithRetry(async () => {
    const { isSupabaseConfigured, supabase } = await import('../lib/supabase');
    if (isSupabaseConfigured()) {
      await supabase.from('personal_items').delete().eq('id', id);
    }
  }, `personal_item_delete_${id}`);
};
