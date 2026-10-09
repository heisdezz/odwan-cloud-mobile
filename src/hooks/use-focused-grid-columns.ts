import { useCallback, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { createFocusedGridColumns } from '@/lib/focused-grid-columns';
import { readGridColumns, subscribeGridColumns } from '@/stores/grid-store';

export function useFocusedGridColumns() {
  const [columns] = useState(() => createFocusedGridColumns(readGridColumns, subscribeGridColumns));
  useFocusEffect(useCallback(() => {
    columns.setFocused(true);
    return () => columns.setFocused(false);
  }, [columns]));
  return useSyncExternalStore(columns.subscribe, columns.getSnapshot, columns.getSnapshot);
}
