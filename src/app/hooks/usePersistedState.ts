import { useState, useEffect, useRef } from 'react';

// Helper to get user-specific storage key
function getStorageKey(userId: string | null, key: string): string {
  if (!userId) return `guest:${key}`;
  return `user:${userId}:${key}`;
}

export function usePersistedState<T>(
  key: string,
  loggedOutDefault: T,
  loggedInDefault: T,
  accessToken: string | null,
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(loggedOutDefault);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const lastLoadedRef = useRef<string>('');
  const prevTokenRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggedOutDefaultRef = useRef(loggedOutDefault);
  const loggedInDefaultRef = useRef(loggedInDefault);

  // Extract user ID from access token
  useEffect(() => {
    if (!accessToken) {
      setUserId(null);
      return;
    }

    try {
      // Decode JWT token to get user ID
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      setUserId(payload.sub || null);
    } catch (err) {
      console.error('Failed to decode token:', err);
      setUserId(null);
    }
  }, [accessToken]);

  // Load data when token changes
  useEffect(() => {
    if (accessToken === prevTokenRef.current) return;
    prevTokenRef.current = accessToken;

    if (!accessToken) {
      setValue(loggedOutDefaultRef.current);
      lastLoadedRef.current = JSON.stringify(loggedOutDefaultRef.current);
      setIsLoaded(false);
      return;
    }

    setIsLoaded(false);

    try {
      // Load from localStorage
      const storageKey = getStorageKey(userId, key);
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const data = JSON.parse(stored);
        lastLoadedRef.current = JSON.stringify(data);
        setValue(data);
      } else {
        const defaultData = loggedInDefaultRef.current;
        lastLoadedRef.current = JSON.stringify(defaultData);
        setValue(defaultData);
      }
      setIsLoaded(true);
    } catch (err) {
      console.error(`Error loading ${key}:`, err);
      const fallback = loggedInDefaultRef.current;
      lastLoadedRef.current = JSON.stringify(fallback);
      setValue(fallback);
      setIsLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, key, userId]);

  // Auto-save when value changes (debounced)
  useEffect(() => {
    if (!accessToken || !isLoaded || !userId) return;
    const serialized = JSON.stringify(value);
    if (serialized === lastLoadedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        lastLoadedRef.current = serialized;
        const storageKey = getStorageKey(userId, key);
        localStorage.setItem(storageKey, serialized);
        console.log(`✓ Saved ${key} to localStorage`);
      } catch (err) {
        console.error(`Error saving ${key}:`, err);
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, accessToken, isLoaded, userId]);

  return [value, setValue, isLoaded];
}
