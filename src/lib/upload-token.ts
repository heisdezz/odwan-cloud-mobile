import { sessionStorage } from './session-storage';
import { normalizeServerUrl } from './server-connection';
const key = (url: string) => 'odwan.upload-token.' + Array.from(normalizeServerUrl(url), (c) => c.codePointAt(0)!.toString(16)).join('-');
export const readUploadToken = (url: string) => sessionStorage.getItem(key(url));
export const saveUploadToken = (url: string, token: string) => sessionStorage.setItem(key(url), token.trim());
