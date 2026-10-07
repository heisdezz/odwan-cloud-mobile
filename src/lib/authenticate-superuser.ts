import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase';
import { pb } from '@/client/pb';
import { useServerStore } from '@/stores/server-store';
import { serverSessions } from './server-session';

export async function authenticateSuperuser({ email, password, verifiedUrl, revision }: { email: string; password: string; verifiedUrl: string | null; revision: number }): Promise<void> {
  if (!verifiedUrl) throw new Error('Test the server connection first.');
  const client = new PocketBase(verifiedUrl, new BaseAuthStore());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const result = await client.collection('_superusers').authWithPassword(email.trim(), password, { signal: controller.signal });
    const current = () => useServerStore.getState().revision === revision && useServerStore.getState().verifiedUrl === verifiedUrl;
    if (!current()) {
      throw new Error('The server changed. Test the connection again.');
    }
    const account = { id: result.record.id, email: result.record.email as string };
    await serverSessions.save(verifiedUrl, { token: result.token, account }, current);
    if (!current()) throw new Error('The server changed. Test the connection again.');
    pb.authStore.save(result.token, result.record);
    useServerStore.getState().setAccount(account);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Login timed out. Please try again.');
    if (error instanceof ClientResponseError) {
      throw new Error(error.status === 400 || error.status === 401
        ? 'Login failed. Check your superuser email and password.'
        : 'Could not log in. Check your connection and try again.');
    }
    throw error;
  } finally { client.authStore.clear(); clearTimeout(timeout); }
}
