-- Create app_users table for sub-admins and trip users management
CREATE TABLE IF NOT EXISTS app_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'subadmin',
  access_level TEXT DEFAULT 'edit', -- 'edit' | 'view_only'
  allowed_components JSONB NOT NULL DEFAULT '["expenses"]'::jsonb,
  allowed_trip_ids JSONB NOT NULL DEFAULT '["*"]'::jsonb, -- ['*'] for all trips or array of trip IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if table already exists
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'edit';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS allowed_trip_ids JSONB DEFAULT '["*"]'::jsonb;

-- Create indexes for faster lookup by email and username
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);

-- Enable Row Level Security on app_users
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Create policies for app_users
DROP POLICY IF EXISTS "Allow public select on app_users" ON app_users;
CREATE POLICY "Allow public select on app_users"
  ON app_users FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow public insert on app_users" ON app_users;
CREATE POLICY "Allow public insert on app_users"
  ON app_users FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on app_users" ON app_users;
CREATE POLICY "Allow public update on app_users"
  ON app_users FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on app_users" ON app_users;
CREATE POLICY "Allow public delete on app_users"
  ON app_users FOR DELETE
  USING (true);

-- Create trigger to auto update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_app_users_timestamp ON app_users;
CREATE TRIGGER update_app_users_timestamp
  BEFORE UPDATE ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION update_app_users_updated_at();

-- Create user_sessions table to limit active sessions to max 5 per account
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT UNIQUE NOT NULL,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on user_sessions" ON user_sessions;
CREATE POLICY "Allow public select on user_sessions" ON user_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on user_sessions" ON user_sessions;
CREATE POLICY "Allow public insert on user_sessions" ON user_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on user_sessions" ON user_sessions;
CREATE POLICY "Allow public update on user_sessions" ON user_sessions FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on user_sessions" ON user_sessions;
CREATE POLICY "Allow public delete on user_sessions" ON user_sessions FOR DELETE USING (true);

-- Ensure user_data table works with sub-users from app_users
ALTER TABLE user_data DROP CONSTRAINT IF EXISTS user_data_user_id_fkey;

-- Allow public RLS policies on user_data table for sync
DROP POLICY IF EXISTS "Allow public select on user_data" ON user_data;
CREATE POLICY "Allow public select on user_data" ON user_data FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on user_data" ON user_data;
CREATE POLICY "Allow public insert on user_data" ON user_data FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on user_data" ON user_data;
CREATE POLICY "Allow public update on user_data" ON user_data FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on user_data" ON user_data;
CREATE POLICY "Allow public delete on user_data" ON user_data FOR DELETE USING (true);
