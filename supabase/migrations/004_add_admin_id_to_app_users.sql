-- Add admin_id column to app_users to scope sub-admins per main admin account (multi-tenant isolation)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS admin_id TEXT;

-- Create index on admin_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_app_users_admin_id ON app_users(admin_id);
