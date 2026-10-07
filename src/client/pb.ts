import PocketBase, { BaseAuthStore } from 'pocketbase';
import type { TypedPocketBase } from '../../pocketbase-types';

// Keep credentials in memory, including on web. The URL comes from Settings.
export const pb = new PocketBase(undefined, new BaseAuthStore()) as TypedPocketBase;
