export function mediaDate(value: string | number | undefined): Date | null {
  if (value === undefined || value === '' || value === 0) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function galleryDay(value: string | number | undefined) {
  const date = mediaDate(value);
  return date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
}
export function galleryMonths<T>(items: readonly T[], dateForItem: (item: T) => string | number | undefined) {
  const seen = new Set<string>();
  const months: { key: string; label: string; index: number }[] = [];
  items.forEach((item, index) => {
    const date = mediaDate(dateForItem(item));
    if (!date) return;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (seen.has(key)) return;
    seen.add(key);
    months.push({ key, label: date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' }), index });
  });
  return months;
}
