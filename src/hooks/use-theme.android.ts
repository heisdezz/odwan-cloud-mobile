import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { useAppTheme } from '@/providers/app-theme-provider';

export function useTheme() {
  const { colorScheme } = useAppTheme();
  const colors = useMaterialColors({ colorScheme });
  return {
    text: colors.onSurface,
    background: colors.surface,
    backgroundElement: colors.surfaceContainer,
    backgroundSelected: colors.secondaryContainer,
    textSecondary: colors.onSurfaceVariant,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    outline: colors.outline,
    error: colors.error,
  };
}
