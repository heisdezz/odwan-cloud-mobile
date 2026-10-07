export function normalizeServerUrl(input: string): string {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Enter a valid URL, including https:// or http://.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTP or HTTPS server URL without credentials, a query, or a fragment.');
  }
  return url.toString().replace(/\/+$/, '');
}

export async function testServerConnection(input: string): Promise<string> {
  const url = normalizeServerUrl(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${url}/api/test/connection`, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Connection failed (HTTP ${response.status}).`);
    const body = (await response.text()).trim();
    if (body !== 'ok' && body !== '"ok"') throw new Error('The server did not return ok. Check the URL.');
    return url;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Connection timed out. Check the URL and your network.');
    if (error instanceof TypeError) throw new Error('Could not reach the server. Check the URL and your network.');
    throw error;
  } finally { clearTimeout(timeout); }
}
