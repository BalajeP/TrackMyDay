import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export function useSupabasePersistedState<T>(
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

  // All useEffect calls third

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
      const extractedUserId = payload.sub || null;
      console.log(`[${key}] Extracted userId from token:`, extractedUserId);
      setUserId(extractedUserId);
    } catch (err) {
      console.error(`[${key}] Failed to decode token:`, err);
      setUserId(null);
    }
  }, [accessToken, key]);

  // 3. Load data from Supabase when userId changes
  useEffect(() => {
    if (!accessToken || !userId) {
      console.log(`[${key}] No auth, using default`);
      setValue(loggedOutDefaultRef.current);
      lastSavedRef.current = JSON.stringify(loggedOutDefaultRef.current);
      setIsLoaded(false);
      setHasUnsavedChanges(false);
      return;
    }

    console.log(`[${key}] Loading from Supabase database...`);
    setIsLoaded(false);

    // Load from Supabase database
    supabase
      .from('user_data')
      .select('data_value')
      .eq('user_id', userId)
      .eq('data_key', key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error(`[${key}] Error loading from Supabase:`, error);
          const fallback = loggedInDefaultRef.current;
          lastSavedRef.current = JSON.stringify(fallback);
          setValue(fallback);
          setIsLoaded(true);
          return;
        }

        if (data && data.data_value) {
          const loadedData = data.data_value as T;
          lastSavedRef.current = JSON.stringify(loadedData);
          setValue(loadedData);
          console.log(`✓ [${key}] Loaded from Supabase database`);
        } else {
          const defaultData = loggedInDefaultRef.current;
          lastSavedRef.current = JSON.stringify(defaultData);
          setValue(defaultData);
          console.log(`✓ [${key}] No saved data in database, using default`);
        }
        setIsLoaded(true);
        setHasUnsavedChanges(false);
      });
  }, [accessToken, key, userId]);

  // 4. Track unsaved changes
  useEffect(() => {
    if (!isLoaded) return;
    const serialized = JSON.stringify(value);
    setHasUnsavedChanges(serialized !== lastSavedRef.current);
  }, [value, isLoaded]);

  // Manual save function - saves to Supabase database
  const save = useCallback(async () => {
    if (!accessToken || !userId) {
      console.warn(`✗ [${key}] Cannot save: ${!accessToken ? 'no access token' : 'no user ID'}`);
      return;
    }

    try {
      const currentValue = valueRef.current;
      const serialized = JSON.stringify(currentValue);

      console.log(`[${key}] Saving to Supabase database...`);

      // Upsert to Supabase database
      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: userId,
          data_key: key,
          data_value: currentValue,
        }, {
          onConflict: 'user_id,data_key'
        });

      if (error) {
        console.error(`✗ [${key}] Error saving to Supabase:`, error);
        throw error;
      }

      lastSavedRef.current = serialized;
      setHasUnsavedChanges(false);
      console.log(`✓ [${key}] SAVED to Supabase database`);

      // Verify it was saved
      const { data: verification } = await supabase
        .from('user_data')
        .select('data_value')
        .eq('user_id', userId)
        .eq('data_key', key)
        .maybeSingle();

      if (verification) {
        console.log(`✓ [${key}] VERIFIED: Data exists in database`);
      } else {
        console.error(`✗ [${key}] ERROR: Data was not saved to database!`);
      }
    } catch (err) {
      console.error(`✗ [${key}] Error saving:`, err);
    }
  }, [accessToken, userId, key]);

  return [value, setValue, save, hasUnsavedChanges, isLoaded];
}
