import { selectionFeedback } from '@/lib/haptics';
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { BackHandler } from 'react-native';
import { create } from 'zustand';
import type { MediaSelectionStore } from '@/lib/media-selection';

export const useSelectionNavigation = create(() => ({ hidden: false }));

/** Only the focused screen owns tab visibility and Android's selection Back action. */
export function useSelectionTabBar(selection: MediaSelectionStore) {
  useFocusEffect(useCallback(() => {
    let wasSelecting = selection.getState().selecting;
    const publish = () => {
      const selecting = selection.getState().selecting;
      if (selecting && !wasSelecting) selectionFeedback();
      wasSelecting = selecting;
      useSelectionNavigation.setState({ hidden: selecting });
    };
    publish();
    const unsubscribe = selection.subscribe(publish);
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!selection.getState().selecting) return false;
      selection.getState().clear();
      return true;
    });
    return () => { unsubscribe(); back.remove(); useSelectionNavigation.setState({ hidden: false }); };
  }, [selection]));
}
