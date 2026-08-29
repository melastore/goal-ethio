// localStorage that never throws. Private windows reject it outright, and a
// failed read should mean "nothing saved yet", not a blank page.

export function readText(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable or full; the in-memory state stays correct.
  }
}

/**
 * Reads and parses a JSON value, falling back whenever it is missing, unreadable,
 * corrupt, or the wrong shape. `isValid` guards against data written by an older
 * version of the app.
 */
export function readJson<T>(
  key: string,
  fallback: T,
  isValid?: (value: unknown) => value is T
): T {
  const raw = readText(key);
  if (raw === null) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid && !isValid(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    writeText(key, JSON.stringify(value));
  } catch {
    // Value could not be serialised; nothing sensible to persist.
  }
}
