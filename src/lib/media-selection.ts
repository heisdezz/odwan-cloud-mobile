import { createStore } from 'zustand/vanilla';

export function createMediaSelectionStore() {
  return createStore<{
    selecting: boolean; selected: Set<string>;
    start: (id?: string) => void; toggle: (id: string) => void;
    replace: (ids: readonly string[]) => void; remove: (ids: readonly string[]) => void; clear: () => void;
  }>((set) => ({
    selecting: false, selected: new Set(),
    start: (id) => set((state) => ({ selecting: true, selected: id ? new Set(state.selected).add(id) : state.selected })),
    toggle: (id) => set((state) => {
      const selected = new Set(state.selected);
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      return { selected };
    }),
    replace: (ids) => set({ selecting: true, selected: new Set(ids) }),
    remove: (ids) => set((state) => {
      const selected = new Set(state.selected);
      for (const id of ids) selected.delete(id);
      return { selected, selecting: selected.size > 0 };
    }),
    clear: () => set({ selecting: false, selected: new Set() }),
  }));
}
export type MediaSelectionStore = ReturnType<typeof createMediaSelectionStore>;
