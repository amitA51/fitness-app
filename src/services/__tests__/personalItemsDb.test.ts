import { beforeEach, describe, expect, it } from 'vitest';
import {
  addPersonalItem,
  getPersonalItems,
  removePersonalItem,
  updatePersonalItem,
} from '../personalItemsDb';

interface StoredItem {
  id: string;
  title: string;
  content?: string;
  updatedAt: string;
}

beforeEach(() => {
  localStorage.clear();
});

describe('personalItemsDb', () => {
  it('creates an item and reads it back', async () => {
    const created = (await addPersonalItem({ title: 'Squats', content: 'heavy' })) as StoredItem;

    expect(created.id).toMatch(/^item-/);
    expect(created.title).toBe('Squats');

    const all = (await getPersonalItems()) as StoredItem[];
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(created.id);
  });

  it('lists all items', async () => {
    await addPersonalItem({ title: 'A' });
    await addPersonalItem({ title: 'B' });
    await addPersonalItem({ title: 'C' });

    const items = (await getPersonalItems()) as StoredItem[];
    expect(items.map((i) => i.title).sort()).toEqual(['A', 'B', 'C']);
  });

  it('updates persist changes', async () => {
    const created = (await addPersonalItem({ title: 'original' })) as StoredItem;

    await updatePersonalItem(created.id, { title: 'edited' });

    const items = (await getPersonalItems()) as StoredItem[];
    const found = items.find((i) => i.id === created.id);
    expect(found?.title).toBe('edited');
    expect(found?.updatedAt).toBeDefined();
  });

  it('removes an item', async () => {
    const a = (await addPersonalItem({ title: 'keep' })) as StoredItem;
    const b = (await addPersonalItem({ title: 'drop' })) as StoredItem;

    await removePersonalItem(b.id);

    const items = (await getPersonalItems()) as StoredItem[];
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe(a.id);
  });

  it('update on missing id is a no-op', async () => {
    await updatePersonalItem('does-not-exist', { title: 'ignored' });
    const items = await getPersonalItems();
    expect(items).toEqual([]);
  });
});
