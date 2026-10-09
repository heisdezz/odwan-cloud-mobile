import { useEffect, useState } from 'react';
export function useDebouncedValue<T>(value: T, delay = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const timeout = setTimeout(() => setSettled(value), delay); return () => clearTimeout(timeout); }, [value, delay]);
  return settled;
}
