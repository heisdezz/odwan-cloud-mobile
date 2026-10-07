import { useState, type ReactElement } from 'react';
import { useWindowDimensions } from 'react-native';
import { ZoomGrid, type ZoomGridProps } from 'react-native-zoom-grid';
import { clampColumns } from '@/helpers/grid-zoom';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

const ZOOM_LEVELS = [6, 5, 4, 3, 2];
type GridZoomProps<T> = {
  data: T[];
  renderItem: ZoomGridProps<T>['renderItem'];
  keyExtractor: (item: T) => string;
  extraData?: unknown;
  contentInsets?: { top?: number; bottom?: number };
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  ListEmptyComponent?: ReactElement;
  ListFooterComponent?: ReactElement | null;
};
/** The package owns scrolling and pinch transitions; an extra Native gesture would compete with its lists. */
export function GridZoom<T>(props: GridZoomProps<T>) {
  const { width } = useWindowDimensions();
  const [initialColumns] = useState(() => clampColumns(Math.floor(width / 150)));
  const colors = useTheme();
  return <ZoomGrid<T> {...props} invert={false} recycleItems={true} zoomLevels={ZOOM_LEVELS} initialNumColumns={initialColumns}
    gridStyle={tw.style('flex-1', { backgroundColor: colors.background })} />;
}
