import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { isMediaFilter, type MediaFilter } from "@/helpers/media-filter";
import { clampColumns } from "@/helpers/grid-zoom";
import { preferencesStorage } from "@/lib/preferences-storage";

type GridState = {
  columns: number | null;
  mediaFilter: MediaFilter;
  setMediaFilter: (filter: MediaFilter) => void;
  setColumns: (columns: number) => void;
};

export function createGridStore(storage: StateStorage) {
  return createStore<GridState>()(
    persist(
      (set) => ({
        columns: null,
        mediaFilter: "all",
        setMediaFilter: (mediaFilter) => {
          if (isMediaFilter(mediaFilter)) set({ mediaFilter });
        },
        setColumns: (columns) => {
          if (Number.isFinite(columns)) set({ columns: clampColumns(columns) });
        },
      }),
      {
        name: "odwan-grid-preferences",
        storage: createJSONStorage(() => storage),
        partialize: ({ columns, mediaFilter }) => ({ columns, mediaFilter }),
        merge: (persisted, current) => {
          const columns = (persisted as Partial<GridState> | undefined)
            ?.columns;
          const mediaFilter = (persisted as Partial<GridState> | undefined)
            ?.mediaFilter;
          return {
            ...current,
            mediaFilter: isMediaFilter(mediaFilter) ? mediaFilter : "all",
            columns:
              typeof columns === "number" && Number.isFinite(columns)
                ? clampColumns(columns)
                : null,
          };
        },
      },
    ),
  );
}

const gridStore = createGridStore(preferencesStorage);
export const readGridColumns = () => gridStore.getState().columns;
export const subscribeGridColumns = (listener: () => void) => gridStore.subscribe(listener);
export const useGridStore = <T>(selector: (state: GridState) => T) =>
  useStore(gridStore, selector);
