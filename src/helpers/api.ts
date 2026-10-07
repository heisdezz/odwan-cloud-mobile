type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | undefined =>
  value !== null && typeof value === 'object' ? value as ObjectValue : undefined;
const message = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** PocketBase, validation, network, and standard errors without unsafe casts. */
export function extract_message(error: unknown): string {
  if (error == null) return 'An unknown error occurred.';
  const direct = message(error);
  if (direct) return direct;
  const data = object(error);
  const response = object(data?.response);
  const nested = object(response?.data);
  const preferred = message(response?.message) ?? message(nested?.message);
  if (preferred) return preferred;
  const standard = message(data?.message) ?? message(object(data?.cause)?.message);
  if (standard) return standard;
  const fields = object(object(data?.data)?.data) ?? object(data?.data) ?? nested;
  const validation = Object.entries(fields ?? {}).flatMap(([field, value]) => {
    const text = message(value) ?? message(object(value)?.message);
    return text ? [`${field}: ${text}`] : [];
  });
  return validation.length ? validation.join('\n') : 'An unexpected error occurred.';
}
