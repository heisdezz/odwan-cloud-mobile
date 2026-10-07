import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase';
import { pb } from '@/client/pb';
import { useServerStore } from '@/stores/server-store';
import { normalizeServerUrl } from './server-connection';
import { createSessionVault } from './session-vault';
import { sessionStorage } from './session-storage';

export const serverSessions = createSessionVault(sessionStorage);
const restoring = new Map<string, Promise<void>>();

/** Validate remembered tokens on an isolated client before installing them. */
export async function restoreServerSession(url: string, revision: number, sessions = serverSessions): Promise<void> {
  const serverUrl = normalizeServerUrl(url);
  const key = `${serverUrl}:${revision}`;
  const existing = restoring.get(key);
  if (existing) return existing;
  const current = () => {
    const state = useServerStore.getState();
    if (state.revision !== revision || state.account) return false;
    try { return normalizeServerUrl(state.urlInput) === serverUrl; } catch { return false; }
  };
  const task = (async () => {
    const saved = await sessions.read(serverUrl);
    if (!saved || !current()) return;
    const client = new PocketBase(serverUrl, new BaseAuthStore());
    client.authStore.save(saved.token);
    if (!client.authStore.isValid) { await sessions.remove(serverUrl, current); return; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const result = await client.collection('_superusers').authRefresh({ signal: controller.signal });
      if (!current()) return;
      const account = { id: result.record.id, email: result.record.email as string };
      await sessions.save(serverUrl, { token: result.token, account }, current);
      if (!current()) return;
      if (!useServerStore.getState().verify(serverUrl, revision)) return;
      pb.authStore.save(result.token, result.record);
      useServerStore.getState().setAccount(account);
    } catch (error) {
      // Keep the session on transient network failures; revoke only rejected credentials.
      if (error instanceof ClientResponseError && [401, 403].includes(error.status)) {
        if (current()) await sessions.remove(serverUrl, current);
      } else throw error;
    } finally { clearTimeout(timeout); client.authStore.clear(); }
  })();
  restoring.set(key, task);
  void task.finally(() => { if (restoring.get(key) === task) restoring.delete(key); }).catch(() => {});
  return task;
}

export async function logoutServerSession() {
  const state = useServerStore.getState();
  const url = state.verifiedUrl;
  state.logout();
  if (url) await serverSessions.remove(url);
}
