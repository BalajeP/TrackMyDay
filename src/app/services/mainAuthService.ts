import { supabase } from '../../lib/supabaseClient';
import { AppUserProfile } from './subAdminService';

const ALL_COMPONENTS = ['activities', 'tracking', 'meals', 'workout', 'plans', 'expenses', 'calendar'];

/**
 * Service for Main Account Registration (Sign Up) & Authentication (Supabase Auth)
 */
export const mainAuthService = {
  /**
   * Helper to construct AppUserProfile for Main Admin Account
   */
  createAdminProfile(email: string, id: string, name?: string, activeSessionsCount?: number): AppUserProfile {
    return {
      id,
      email,
      username: email.split('@')[0],
      name: name || 'Admin',
      role: 'admin',
      accessLevel: 'edit',
      allowedComponents: ALL_COMPONENTS,
      allowedTripIds: ['*'],
      isMainAdmin: true,
      activeSessionsCount,
    };
  },

  /**
   * Main Account Creation (Sign Up via Supabase Auth)
   */
  async signUp(email: string, password: string, name: string): Promise<{ success: boolean; profile?: AppUserProfile; session?: any; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name || '' },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user && !data.session) {
        return { success: false, error: 'Please check your email to confirm your account.' };
      }

      if (data.user && data.session) {
        const profile = this.createAdminProfile(data.user.email || email, data.user.id, name);
        return { success: true, profile, session: data.session };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: `Signup failed: ${err}` };
    }
  },

  /**
   * Main Account Sign In via Supabase Auth
   */
  async signIn(email: string, password: string): Promise<{ success: boolean; profile?: AppUserProfile; session?: any; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        const profile = this.createAdminProfile(
          data.user.email || email,
          data.user.id,
          data.user.user_metadata?.name
        );
        return { success: true, profile, session: data.session };
      }

      return { success: false, error: 'Invalid username/email or password.' };
    } catch (err) {
      return { success: false, error: `Login failed: ${err}` };
    }
  },

  /**
   * Main Account Sign Out
   */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },
};
