import { useState, useEffect, useRef, useCallback } from 'react';

// Helper to get user-specific storage key
function getStorageKey(userId: string | null, key: string): string {
  if (!userId) return `guest:${key}`;
  return `user:${userId}:${key}`;
}

export function useManualPersistedState<T>(
  key: string,
  loggedOutDefault: T,
  loggedInDefault: T,
  accessToken: string | null,
): [T, React.Dispatch<React.SetStateAction<T>>, () => void, boolean, boolean] {
  // All useState calls first
  const [value, setValue] = useState<T>(loggedOutDefault);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // All useRef calls second
  const lastSavedRef = useRef<string>('');
  const valueRef = useRef<T>(value);
  const loggedOutDefaultRef = useRef(loggedOutDefault);
  const loggedInDefaultRef = useRef(loggedInDefault);

  // All useEffect calls third (in consistent order)

  // 1. Keep valueRef in sync with value
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // 2. Extract user ID from access token
  useEffect(() => {
    if (!accessToken) {
      setUserId(null);
      return;
    }

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      setUserId(payload.sub || null);
    } catch (err) {
      console.error('Failed to decode token:', err);
      setUserId(null);
    }
  }, [accessToken]);

  // 3. Load data when component mounts or userId changes
  useEffect(() => {
    if (!accessToken) {
      setValue(loggedOutDefaultRef.current);
      lastSavedRef.current = JSON.stringify(loggedOutDefaultRef.current);
      setIsLoaded(false);
      setHasUnsavedChanges(false);
      return;
    }

    // Wait for userId to be extracted from token
    if (!userId) {
      return;
    }

    setIsLoaded(false);

    try {
      const storageKey = getStorageKey(userId, key);
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const data = JSON.parse(stored);
        lastSavedRef.current = JSON.stringify(data);
        setValue(data);
        console.log(`✓ Loaded ${key} from localStorage:`, storageKey);
      } else {
        const defaultData = loggedInDefaultRef.current;
        lastSavedRef.current = JSON.stringify(defaultData);
        setValue(defaultData);
        console.log(`✓ No saved data for ${key}, using default`);
      }
      setIsLoaded(true);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error(`Error loading ${key}:`, err);
      const fallback = loggedInDefaultRef.current;
      lastSavedRef.current = JSON.stringify(fallback);
      setValue(fallback);
      setIsLoaded(true);
      setHasUnsavedChanges(false);
    }
  }, [accessToken, key, userId]);

  // 4. Track unsaved changes
  useEffect(() => {
    if (!isLoaded) return;
    const serialized = JSON.stringify(value);
    setHasUnsavedChanges(serialized !== lastSavedRef.current);
  }, [value, isLoaded]);

  // useCallback at the end (after all hooks)
  // Manual save function - uses valueRef to ensure we save the latest state
  const save = useCallback(() => {
    if (!accessToken || !userId) {
      console.warn(`Cannot save ${key}: ${!accessToken ? 'no access token' : 'no user ID'}`);
      return;
    }

    try {
      const currentValue = valueRef.current;
      const serialized = JSON.stringify(currentValue);
      const storageKey = getStorageKey(userId, key);
      localStorage.setItem(storageKey, serialized);
      lastSavedRef.current = serialized;
      setHasUnsavedChanges(false);
      console.log(`✓ Saved ${key} to localStorage:`, storageKey);
      console.log(`  Data preview:`, serialized.substring(0, 100) + '...');
    } catch (err) {
      console.error(`✗ Error saving ${key}:`, err);
    }
  }, [accessToken, userId, key]);

  return [value, setValue, save, hasUnsavedChanges, isLoaded];
}
