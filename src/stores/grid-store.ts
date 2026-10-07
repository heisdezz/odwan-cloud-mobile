import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { clampColumns } from '@/helpers/grid-zoom';
import { preferencesStorage } from '@/lib/preferences-storage';

type GridState = {
  columns: number | null;
  setColumns: (columns: number) => void;
};

export function createGridStore(storage: StateStorage) {
  return createStore<GridState>()(persist((set) => ({
    columns: null,
    setColumns: (columns) => { if (Number.isFinite(columns)) set({ columns: clampColumns(columns) }); },
  }), {
    name: 'odwan-grid-preferences',
    storage: createJSONStorage(() => storage),
    partialize: ({ columns }) => ({ columns }),
    merge: (persisted, current) => {
      const columns = (persisted as Partial<GridState> | undefined)?.columns;
      return { ...current, columns: typeof columns === 'number' && Number.isFinite(columns) ? clampColumns(columns) : null };
    },
  }));
}

const gridStore = createGridStore(preferencesStorage);
export const useGridStore = <T,>(selector: (state: GridState) => T) => useStore(gridStore, selector);
