-- Create a function to allow password reset by email directly (for single user local/dev setup)
CREATE OR REPLACE FUNCTION reset_user_password(user_email TEXT, new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get user ID for the email
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Update password (GoTrue/Supabase uses bcrypt)
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = user_id;

  RETURN TRUE;
END;
$$;
