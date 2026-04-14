// Personal items database stub
export const addPersonalItem = async (item: unknown): Promise<unknown> => {
  // Local storage fallback
  const stored = localStorage.getItem('personalItems');
  const items = stored ? JSON.parse(stored) : [];
  const newItem = { ...(item as Record<string, unknown>), id: `item-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(newItem);
  localStorage.setItem('personalItems', JSON.stringify(items));
  return newItem;
};

export const getPersonalItems = async (): Promise<unknown[]> => {
  const stored = localStorage.getItem('personalItems');
  return stored ? JSON.parse(stored) : [];
};

export const updatePersonalItem = async (id: string, updates: unknown): Promise<void> => {
  const stored = localStorage.getItem('personalItems');
  if (!stored) return;
  const items = JSON.parse(stored);
  const index = items.findIndex((i: { id: string }) => i.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...(updates as Record<string, unknown>), updatedAt: new Date().toISOString() };
    localStorage.setItem('personalItems', JSON.stringify(items));
  }
};

export const removePersonalItem = async (id: string): Promise<void> => {
  const stored = localStorage.getItem('personalItems');
  if (!stored) return;
  const items = JSON.parse(stored);
  const filtered = items.filter((i: { id: string }) => i.id !== id);
  localStorage.setItem('personalItems', JSON.stringify(filtered));
};