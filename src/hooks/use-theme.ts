import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/providers/app-theme-provider';

export function useTheme() {
  const { colorScheme } = useAppTheme();
  return {
    ...Colors[colorScheme],
    primary: colorScheme === 'dark' ? '#D0BCFF' : '#6750A4',
    onPrimary: colorScheme === 'dark' ? '#381E72' : '#FFFFFF',
    outline: colorScheme === 'dark' ? '#938F99' : '#79747E',
    error: colorScheme === 'dark' ? '#F2B8B5' : '#B3261E',
  };
}
