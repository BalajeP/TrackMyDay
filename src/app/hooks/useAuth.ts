import { useState, useEffect, useCallback, useRef } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { subAdminService, AppUserProfile, AppUserRecord } from '../services/subAdminService';
import { mainAuthService } from '../services/mainAuthService';

export type { AppUserProfile, AppUserRecord };

const ALL_COMPONENTS = ['activities', 'tracking', 'meals', 'workout', 'expenses', 'calendar'];
const MAIN_ADMIN_EMAILS = ['slbbalaje@gmail.com', 'slbbalaji@gmail.com'];
const MAX_CONCURRENT_USERS = 20;

export function isMainAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return MAIN_ADMIN_EMAILS.some((e) => lower === e.toLowerCase());
}

// Generate a persistent unique device session ID
function getDeviceSessionId(): string {
  let devId = localStorage.getItem('tmd_device_session_id');
  if (!devId) {
    devId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('tmd_device_session_id', devId);
  }
  return devId;
}

// Helper to check active sessions & register current device (max 5 active sessions)
async function registerUserSession(accountIdentifier: string): Promise<{ allowed: boolean; activeCount: number; error?: string }> {
  const deviceId = getDeviceSessionId();
  const cleanId = accountIdentifier.trim().toLowerCase();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  try {
    // 1. Delete stale sessions older than 5 minutes
    await supabase.from('user_sessions').delete().eq('user_id', cleanId).lt('last_active', fiveMinAgo);

    // 2. Fetch active sessions for this account
    const { data: activeSessions, error: fetchErr } = await supabase
      .from('user_sessions')
      .select('session_id, last_active')
      .eq('user_id', cleanId);

    if (fetchErr) {
      console.warn('Session check warning:', fetchErr);
    }

    const sessions = activeSessions || [];
    const existingSession = sessions.find((s) => s.session_id === deviceId);

    if (existingSession) {
      // Re-activate current device session
      await supabase.from('user_sessions').update({ last_active: new Date().toISOString() }).eq('session_id', deviceId);
      return { allowed: true, activeCount: sessions.length };
    }

    // New device login attempt: enforce 5 users limit
    if (sessions.length >= MAX_CONCURRENT_USERS) {
      return {
        allowed: false,
        activeCount: sessions.length,
        error: `User limit exceeded: Maximum ${MAX_CONCURRENT_USERS} users allowed to login and use this account concurrently. Active session limit reached.`,
      };
    }

    // Register new session
    await supabase.from('user_sessions').insert([
      {
        user_id: cleanId,
        session_id: deviceId,
        last_active: new Date().toISOString(),
      },
    ]);

    return { allowed: true, activeCount: sessions.length + 1 };
  } catch (err) {
    console.error('Failed to register user session:', err);
    return { allowed: true, activeCount: 1 };
  }
}

// Helper to remove current device session on logout
async function unregisterUserSession(accountIdentifier?: string) {
  const deviceId = getDeviceSessionId();
  try {
    if (accountIdentifier) {
      await supabase.from('user_sessions').delete().eq('session_id', deviceId);
    } else {
      await supabase.from('user_sessions').delete().eq('session_id', deviceId);
    }
  } catch (err) {
    console.warn('Failed to unregister session:', err);
  }
}

// Generate a synthetic JWT token string for sub-users so useSupabasePersistedState can extract userId & adminId
function createSubUserToken(user: AppUserProfile): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: user.id, adminId: user.adminId, email: user.email, role: user.role, isMainAdmin: user.isMainAdmin }));
  const sig = btoa('subuser_signature');
  return `${header}.${payload}.${sig}`;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session Heartbeat effect while logged in
  useEffect(() => {
    if (!userProfile) return;

    const interval = setInterval(async () => {
      const deviceId = getDeviceSessionId();
      await supabase.from('user_sessions').update({ last_active: new Date().toISOString() }).eq('session_id', deviceId);
    }, 60000);

    return () => clearInterval(interval);
  }, [userProfile]);

  // Load session & sub-user from localStorage on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        // 1. Check if sub-user session exists in localStorage
        const storedSubUserRaw = localStorage.getItem('tmd_sub_user_session');
        if (storedSubUserRaw) {
          const storedSubUser: AppUserProfile = JSON.parse(storedSubUserRaw);
          // Verify with database that sub-user still exists in app_users
          const { data: dbUser, error: fetchErr } = await supabase
            .from('app_users')
            .select('*')
            .eq('id', storedSubUser.id)
            .maybeSingle();

          if (dbUser && !fetchErr) {
            const activeProfile: AppUserProfile = {
              id: dbUser.id,
              adminId: dbUser.admin_id || undefined,
              email: dbUser.email,
              username: dbUser.username,
              name: dbUser.name,
              role: dbUser.role || 'subadmin',
              accessLevel: (dbUser.access_level as 'edit' | 'view_only') || 'edit',
              allowedComponents: Array.isArray(dbUser.allowed_components) && dbUser.allowed_components.length > 0
                ? dbUser.allowed_components
                : ['expenses'],
              allowedTripIds: Array.isArray(dbUser.allowed_trip_ids) && dbUser.allowed_trip_ids.length > 0
                ? dbUser.allowed_trip_ids
                : ['*'],
              isMainAdmin: false,
            };
            if (isMounted) {
              setUserProfile(activeProfile);
              localStorage.setItem('tmd_sub_user_session', JSON.stringify(activeProfile));
              setLoading(false);
            }
            return;
          } else {
            // User was removed by admin from database
            localStorage.removeItem('tmd_sub_user_session');
            if (isMounted) {
              setError('Your account has been removed or disabled by the administrator.');
            }
          }
        }

        // 2. Fall back to Supabase auth session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user) {
          setSession(currentSession);
          const email = currentSession.user.email || '';
          const profile = mainAuthService.createAdminProfile(email, currentSession.user.id, currentSession.user.user_metadata?.name);
          if (isMounted) {
            setUserProfile(profile);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const storedSubUser = localStorage.getItem('tmd_sub_user_session');
      if (!storedSubUser && newSession?.user) {
        setSession(newSession);
        const email = newSession.user.email || '';
        setUserProfile(mainAuthService.createAdminProfile(email, newSession.user.id, newSession.user.user_metadata?.name));
      } else if (!storedSubUser && !newSession) {
        setSession(null);
        setUserProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Periodic check to verify sub-user is still active in database & update permissions in real-time
  useEffect(() => {
    if (!userProfile || userProfile.isMainAdmin) return;

    const checkInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, admin_id, allowed_components, access_level, allowed_trip_ids')
        .eq('id', userProfile.id)
        .maybeSingle();

      if (error || !data) {
        console.warn('Sub-user account removed by admin. Logging out...');
        localStorage.removeItem('tmd_sub_user_session');
        setUserProfile(null);
        setError('Your account has been removed by the administrator.');
      } else {
        const newAccess = (data.access_level as 'edit' | 'view_only') || 'edit';
        const newTripIds = Array.isArray(data.allowed_trip_ids) ? data.allowed_trip_ids : ['*'];
        if (
          JSON.stringify(data.allowed_components) !== JSON.stringify(userProfile.allowedComponents) ||
          JSON.stringify(newTripIds) !== JSON.stringify(userProfile.allowedTripIds) ||
          newAccess !== userProfile.accessLevel
        ) {
          setUserProfile((prev) =>
            prev
              ? {
                  ...prev,
                  allowedComponents: data.allowed_components,
                  allowedTripIds: newTripIds,
                  accessLevel: newAccess,
                }
              : null
          );
        }
      }
    }, 10000);

    return () => clearInterval(checkInterval);
  }, [userProfile]);

  // Login handler: accepts email or username + password
  const login = async (identifier: string, password: string): Promise<boolean> => {
    setError(null);
    const cleanIdentifier = identifier.trim().toLowerCase();

    try {
      // Enforce Concurrent Session Limit (Max 5 users allowed)
      const sessionRes = await registerUserSession(cleanIdentifier);
      if (!sessionRes.allowed) {
        setError(sessionRes.error || `User limit exceeded: Maximum ${MAX_CONCURRENT_USERS} concurrent users allowed for this account.`);
        return false;
      }

      // Step A: Check subAdminService for sub-admins / trip users
      const subUser = await subAdminService.loginSubAdmin(cleanIdentifier, password);
      if (subUser) {
        subUser.activeSessionsCount = sessionRes.activeCount;
        localStorage.setItem('tmd_sub_user_session', JSON.stringify(subUser));
        setUserProfile(subUser);
        return true;
      }

      // Step B: Attempt Main Account Supabase Auth
      const mainRes = await mainAuthService.signIn(cleanIdentifier, password);
      if (mainRes.success && mainRes.profile && mainRes.session) {
        localStorage.removeItem('tmd_sub_user_session');
        setSession(mainRes.session);
        mainRes.profile.activeSessionsCount = sessionRes.activeCount;
        setUserProfile(mainRes.profile);
        return true;
      }

      setError(mainRes.error || 'Invalid username/email or password.');
      return false;
    } catch (err) {
      setError(`Login failed: ${err}`);
      return false;
    }
  };

  // Main Account Creation (Sign Up via Supabase Auth)
  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    setError(null);
    const res = await mainAuthService.signUp(email, password, name);
    if (!res.success) {
      setError(res.error || 'Signup failed.');
      return false;
    }

    if (res.profile && res.session) {
      localStorage.removeItem('tmd_sub_user_session');
      setSession(res.session);
      setUserProfile(res.profile);
    }
    return true;
  };

  const logout = async () => {
    await unregisterUserSession(userProfile?.email || userProfile?.username);
    localStorage.removeItem('tmd_sub_user_session');
    setUserProfile(null);
    setSession(null);
    await mainAuthService.signOut();
  };

  const resetPassword = async (email: string, newPassword: string): Promise<boolean> => {
    setError(null);
    try {
      const { data, error } = await supabase.rpc('reset_user_password', {
        user_email: email,
        new_password: newPassword,
      });

      if (error) {
        setError(error.message);
        return false;
      }

      if (!data) {
        setError('No account found with this email address.');
        return false;
      }

      return true;
    } catch (err) {
      setError(`Failed to reset password: ${err}`);
      return false;
    }
  };

  // ── Admin Sub-User Management Functions (scoped to logged-in Main Admin ID) ──────────────────────
  const fetchAppUsers = useCallback(async (): Promise<AppUserRecord[]> => {
    if (!userProfile?.id || !userProfile.isMainAdmin) return [];
    return subAdminService.fetchSubAdmins(userProfile.id);
  }, [userProfile]);

  const createAppUser = useCallback(async (newUser: Omit<AppUserRecord, 'id'>): Promise<{ success: boolean; error?: string }> => {
    if (!userProfile?.id || !userProfile.isMainAdmin) {
      return { success: false, error: 'Only Main Admin accounts can create sub-users.' };
    }
    return subAdminService.createSubAdmin(userProfile.id, newUser);
  }, [userProfile]);

  const updateAppUser = useCallback(async (id: string, updates: Partial<AppUserRecord>): Promise<{ success: boolean; error?: string }> => {
    if (!userProfile?.id || !userProfile.isMainAdmin) {
      return { success: false, error: 'Only Main Admin accounts can update sub-users.' };
    }
    return subAdminService.updateSubAdmin(userProfile.id, id, updates);
  }, [userProfile]);

  const deleteAppUser = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!userProfile?.id || !userProfile.isMainAdmin) {
      return { success: false, error: 'Only Main Admin accounts can delete sub-users.' };
    }
    return subAdminService.deleteSubAdmin(userProfile.id, id);
  }, [userProfile]);

  // Compute active access token
  const accessToken = userProfile
    ? session?.access_token || createSubUserToken(userProfile)
    : null;

  const changePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!userProfile) return { success: false, error: 'No user logged in.' };
    try {
      if (userProfile.isMainAdmin) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) return { success: false, error: error.message };
        return { success: true };
      } else {
        const { error } = await supabase
          .from('app_users')
          .update({ password: newPassword })
          .eq('id', userProfile.id);
        if (error) return { success: false, error: error.message };
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  };

  return {
    session,
    userProfile,
    accessToken,
    loading,
    error,
    login,
    signup,
    logout,
    resetPassword,
    changePassword,
    clearError: () => setError(null),
    fetchAppUsers,
    createAppUser,
    updateAppUser,
    deleteAppUser,
  };
}

