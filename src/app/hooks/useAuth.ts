import { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return false;
    }
    return true;
  };

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    setError(null);
    try {
      // Use Supabase's built-in signup (no edge function required)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || '',
          },
          // Auto-confirm email since email server isn't configured
          emailRedirectTo: undefined,
        },
      });

      if (error) {
        setError(error.message);
        return false;
      }

      // If email confirmation is required, inform user
      if (data.user && !data.session) {
        setError('Please check your email to confirm your account.');
        return false;
      }

      // Auto-login successful, session is already set
      return true;
    } catch (err) {
      setError(`Signup failed: ${err}`);
      return false;
    }
  };

  const logout = async () => {
    // DON'T clear localStorage - we want to keep user data
    await supabase.auth.signOut();
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

  return {
    session,
    user,
    accessToken: session?.access_token ?? null,
    loading,
    error,
    login,
    signup,
    logout,
    resetPassword,
    clearError: () => setError(null),
  };
}
