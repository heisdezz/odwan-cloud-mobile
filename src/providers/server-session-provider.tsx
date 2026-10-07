import { useEffect, type PropsWithChildren } from 'react';
import { toast } from 'sonner-native';
import { restoreServerSession } from '@/lib/server-session';
import { useServerStore } from '@/stores/server-store';

export function ServerSessionProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const { urlInput, revision } = useServerStore.getState();
    if (!urlInput.trim()) return;
    void restoreServerSession(urlInput, revision).catch(() => {
      if (useServerStore.getState().revision === revision)
        toast.error('Could not restore login. Test the connection to try again.');
    });
  }, []);
  return children;
}
