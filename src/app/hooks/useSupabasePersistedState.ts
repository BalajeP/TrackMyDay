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
  const targetUserIdRef = useRef<string | null>(null);

  // All useEffect calls third

  // 1. Keep valueRef in sync with value
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // 2. Extract user ID from access token
  useEffect(() => {
    if (!accessToken) {
      setUserId(null);
      targetUserIdRef.current = null;
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
      targetUserIdRef.current = null;
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

    // 1. Query for exact user_id match
    supabase
      .from('user_data')
      .select('user_id, data_value')
      .eq('user_id', userId)
      .eq('data_key', key)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error) {
          console.error(`[${key}] Error loading from Supabase:`, error);
        }

        if (data && data.data_value) {
          targetUserIdRef.current = data.user_id;
          const loadedData = data.data_value as T;
          lastSavedRef.current = JSON.stringify(loadedData);
          setValue(loadedData);
          console.log(`✓ [${key}] Loaded exact user record from Supabase database`);
          setIsLoaded(true);
          setHasUnsavedChanges(false);
          return;
        }

        // 2. Fallback for sub-users: query shared user_data record for this data_key
        const { data: sharedList, error: sharedErr } = await supabase
          .from('user_data')
          .select('user_id, data_value')
          .eq('data_key', key)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (!sharedErr && sharedList && sharedList.length > 0 && sharedList[0].data_value) {
          targetUserIdRef.current = sharedList[0].user_id;
          const loadedData = sharedList[0].data_value as T;
          lastSavedRef.current = JSON.stringify(loadedData);
          setValue(loadedData);
          console.log(`✓ [${key}] Loaded shared data record (owned by ${sharedList[0].user_id})`);
        } else {
          targetUserIdRef.current = userId;
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
    const saveUserId = targetUserIdRef.current || userId;
    if (!accessToken || !saveUserId) {
      console.warn(`✗ [${key}] Cannot save: ${!accessToken ? 'no access token' : 'no target user ID'}`);
      return;
    }

    try {
      const currentValue = valueRef.current;
      const serialized = JSON.stringify(currentValue);

      console.log(`[${key}] Saving to Supabase database for user ${saveUserId}...`);

      // Upsert to Supabase database
      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: saveUserId,
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
        .eq('user_id', saveUserId)
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
