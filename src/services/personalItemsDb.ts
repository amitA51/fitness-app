// Personal items database using IndexedDB
// ============================================================================
// DELIBERATELY NOT CLOUD-SYNCED, and that is not an oversight.
//
// A `PersonalItem` here is the scratch container for an IN-PROGRESS workout:
// `templateDb.loadWorkoutFromTemplate()` materialises one from a template each
// time the trainee starts a session, and the durable outcome is the
// `WorkoutSession` that `useWorkoutSave` writes (which IS synced). Nothing here
// is data the user would notice losing — tapping the template again rebuilds it.
//
// It is called out explicitly because a reliability audit flagged this store as a
// permanent-loss risk on the grounds that it is wiped by `clearUserScopedLocalData()`
// and absent from both sync directions. Both halves of that are true; the
// conclusion is not. Syncing an in-progress workout across devices is a separate
// feature with its own conflict semantics ("which device owns the live set?"), not
// a backup, and pushing it would burn a cloud row per started workout for state
// that is obsolete seconds later.
//
// The genuinely at-risk localStorage-only state — body profile, workout prefs,
// nutrition goals, program progress — is handled by ./localStateMirror and
// ./programService instead.
import type { PersonalItem } from '../types';
import { STORES, dbDelete, dbGet, dbGetAll, dbPut } from './indexedDBCore';

export const addPersonalItem = async (
  item: Omit<PersonalItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PersonalItem> => {
  const newItem: PersonalItem = {
    ...item,
    id: `item-${crypto.randomUUID()}`,
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
  const existing = await dbGet<PersonalItem>(STORES.PERSONAL_ITEMS, id);
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
