import type { MediaItemResponse } from '../../pocketbase-types';

/** Page totals can change on refresh without changing any rendered records. */
export function createMediaItemsSelector() {
  let previousPages: MediaItemResponse[][] = [];
  let previousItems: MediaItemResponse[] = [];
  return (pages?: readonly { items: MediaItemResponse[] }[]) => {
    const itemPages = pages?.map((page) => page.items) ?? [];
    if (itemPages.length === previousPages.length && itemPages.every((items, index) => items === previousPages[index]))
      return previousItems;
    const records = new Map<string, MediaItemResponse>();
    for (const items of itemPages) for (const item of items) records.set(item.id, item);
    const next = [...records.values()];
    previousPages = itemPages;
    if (next.length !== previousItems.length || next.some((item, index) => item !== previousItems[index]))
      previousItems = next;
    return previousItems;
  };
}
