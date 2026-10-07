import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { router } from 'expo-router';
import type { ViewerSession } from '@/helpers/media-viewer';

type ViewerContextValue = {
  open: (session: Omit<ViewerSession, 'id'>) => void;
  get: (id?: string) => ViewerSession | null;
  release: (id: string) => void;
};
const ViewerContext = createContext<ViewerContextValue | null>(null);

/** One in-memory snapshot; no large arrays, URIs or auth tokens in route parameters. */
export function MediaViewerProvider({ children }: { children: ReactNode }) {
  const session = useRef<ViewerSession | null>(null);
  const sequence = useRef(0);
  const value = useMemo<ViewerContextValue>(() => ({
    open: (input) => {
      if (!input.items.some((item) => item.id === input.selectedId)) return;
      const id = String(++sequence.current);
      session.current = { ...input, items: [...input.items], id };
      if (input.albumId) router.push({ pathname: '/album/[id]/[mediaId]', params: { id: input.albumId, mediaId: input.selectedId, session: id } });
      else router.push({ pathname: '/media/[mediaId]', params: { mediaId: input.selectedId, session: id, source: input.scope ? 'remote' : 'local' } });
    },
    get: (id) => session.current?.id === id ? session.current : null,
    release: (id) => { if (session.current?.id === id) session.current = null; },
  }), []);
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}
export function useMediaViewer() {
  const value = useContext(ViewerContext);
  if (!value) throw new Error('MediaViewerProvider is missing.');
  return value;
}
