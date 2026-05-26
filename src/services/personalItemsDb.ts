// Personal items database using IndexedDB
import type { PersonalItem } from '../types';
import { STORES, dbDelete, dbGetAll, dbPut, initDB } from './indexedDBCore';

// Ensure DB is initialized
initDB();

export const addPersonalItem = async (
  item: Omit<PersonalItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PersonalItem> => {
  const newItem: PersonalItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as PersonalItem;

  await dbPut(STORES.PERSONAL_ITEMS, newItem);

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
};

export const removePersonalItem = async (id: string): Promise<void> => {
  await dbDelete(STORES.PERSONAL_ITEMS, id);
};
