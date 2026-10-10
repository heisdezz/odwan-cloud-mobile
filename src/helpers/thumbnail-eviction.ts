export type ThumbnailEntry = { uri: string; bytes: number; accessedAt: number };

/** Active files are never candidates, even when they alone exceed the budget. */
export function thumbnailEvictions(entries: readonly ThumbnailEntry[], budget: number, protectedUris: ReadonlySet<string>) {
  let bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const remove: string[] = [];
  for (const entry of entries.filter((entry) => !protectedUris.has(entry.uri)).sort((a, b) => a.accessedAt - b.accessedAt)) {
    if (bytes <= budget) break;
    remove.push(entry.uri);
    bytes -= entry.bytes;
  }
  return remove;
}
