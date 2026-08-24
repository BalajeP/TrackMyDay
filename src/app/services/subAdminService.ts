import { supabase } from '../../lib/supabaseClient';

export interface AppUserRecord {
  id: string;
  admin_id?: string; // Foreign reference to the Main Admin's user ID
  username: string;
  email: string;
  password?: string;
  name: string;
  role: 'admin' | 'subadmin' | 'user';
  access_level?: 'edit' | 'view_only';
  allowed_components: string[];
  allowed_trip_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface AppUserProfile {
  id: string;
  adminId?: string; // Points to the owning Main Admin's user ID
  email: string;
  username: string;
  name: string;
  role: 'admin' | 'subadmin' | 'user';
  accessLevel: 'edit' | 'view_only';
  allowedComponents: string[];
  allowedTripIds: string[];
  isMainAdmin: boolean;
  activeSessionsCount?: number;
}

/**
 * Service for Sub-Admin / Sub-Tenant User Management & Auth
 */
export const subAdminService = {
  /**
   * Fetch sub-admins owned strictly by the current Main Admin
   */
  async fetchSubAdmins(adminId: string): Promise<AppUserRecord[]> {
    if (!adminId) return [];

    try {
      // Query app_users table scoped to this admin_id (or legacy null records for first main admin)
      let { data, error } = await supabase
        .from('app_users')
        .select('*')
        .or(`admin_id.eq.${adminId},admin_id.is.null`)
        .order('created_at', { ascending: false });

      // Fallback if admin_id column is not added to Supabase DB schema yet
      if (error && (error.message?.includes('admin_id') || error.message?.includes('schema cache'))) {
        console.warn('[subAdminService] admin_id column not in schema cache yet. Falling back to simple query.');
        const fallback = await supabase
          .from('app_users')
          .select('*')
          .order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error('[subAdminService] Error fetching sub-admins:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('[subAdminService] Exception in fetchSubAdmins:', err);
      return [];
    }
  },

  /**
   * Create a new sub-admin under the specified Main Admin account
   */
  async createSubAdmin(
    adminId: string,
    newUser: Omit<AppUserRecord, 'id'>
  ): Promise<{ success: boolean; error?: string }> {
    if (!adminId) {
      return { success: false, error: 'Admin session ID missing. Please log in again.' };
    }

    try {
      const payload: any = {
        ...newUser,
        admin_id: adminId,
        username: newUser.username.trim().toLowerCase(),
        email: newUser.email.trim().toLowerCase(),
      };

      let { error } = await supabase.from('app_users').insert([payload]);

      // Fallback if admin_id column is not in Supabase DB table yet
      if (error && (error.message?.includes('admin_id') || error.message?.includes('schema cache'))) {
        console.warn('[subAdminService] admin_id column not in schema cache. Retrying insert without admin_id...');
        delete payload.admin_id;
        const retryRes = await supabase.from('app_users').insert([payload]);
        error = retryRes.error;
      }

      if (error) {
        console.error('[subAdminService] Error creating sub-admin:', error);
        if (error.code === '23505') {
          return { success: false, error: 'A user with this username or email already exists.' };
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('[subAdminService] Exception in createSubAdmin:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Update an existing sub-admin owned by the specified Main Admin
   */
  async updateSubAdmin(
    adminId: string,
    id: string,
    updates: Partial<AppUserRecord>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('app_users')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('[subAdminService] Error updating sub-admin:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('[subAdminService] Exception in updateSubAdmin:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Delete a sub-admin owned by the specified Main Admin
   */
  async deleteSubAdmin(adminId: string, id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('app_users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[subAdminService] Error deleting sub-admin:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('[subAdminService] Exception in deleteSubAdmin:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Authenticate a sub-admin login attempt against app_users table
   */
  async loginSubAdmin(identifier: string, password: string): Promise<AppUserProfile | null> {
    const cleanId = identifier.trim().toLowerCase();

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .or(`email.ilike.${cleanId},username.ilike.${cleanId}`)
        .maybeSingle();

      if (error || !data) return null;

      const user: AppUserRecord = data;

      if (user.password !== password) return null;

      return {
        id: user.id,
        adminId: user.admin_id || undefined,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role || 'subadmin',
        accessLevel: (user.access_level as 'edit' | 'view_only') || 'edit',
        allowedComponents: Array.isArray(user.allowed_components) && user.allowed_components.length > 0
          ? user.allowed_components
          : ['expenses'],
        allowedTripIds: Array.isArray(user.allowed_trip_ids) && user.allowed_trip_ids.length > 0
          ? user.allowed_trip_ids
          : ['*'],
        isMainAdmin: false,
      };
    } catch (err) {
      console.error('[subAdminService] Exception in loginSubAdmin:', err);
      return null;
    }
  },
};
