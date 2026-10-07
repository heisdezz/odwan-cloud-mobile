import PocketBase from "pocketbase";
import { TypedPocketBase } from "../../pocketbase-types";

export const pb = new PocketBase(process.env.PB_URL) as TypedPocketBase;
