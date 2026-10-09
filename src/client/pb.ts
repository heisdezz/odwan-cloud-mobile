import PocketBase, { BaseAuthStore } from "pocketbase";
import type { TypedPocketBase } from "../../pocketbase-types";

// Active session in memory; server-session restores encrypted per-server tokens.
export const pb = new PocketBase(
  undefined,
  new BaseAuthStore(),
) as TypedPocketBase;
