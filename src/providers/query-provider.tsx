import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient({ defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
    mutations: { retry: false, gcTime: 0, networkMode: 'always' },
  } }));
  useEffect(() => {
    if (Platform.OS === 'web') return;
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => subscription.remove();
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
