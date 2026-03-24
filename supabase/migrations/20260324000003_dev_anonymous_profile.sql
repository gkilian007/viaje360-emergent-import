-- Dev-only: create anonymous user in auth.users and profiles for local development
-- The anonymous dev user ID matches DEV_ANONYMOUS_USER_ID in src/lib/auth/identity.ts

-- First insert into auth.users (required by FK on profiles)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev@viaje360.local',
  '$2a$10$PznZGZr1zTQYBOCLYs2oaeWMjLo0mxbp5mOOaOQqGcYGjlDCUnNWi', -- bcrypt hash of 'dev-password'
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Dev User"}',
  now(),
  now(),
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Then create the profile
INSERT INTO public.profiles (
  id,
  name,
  avatar_url,
  level,
  xp,
  title
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Dev User',
  null,
  1,
  0,
  'Viajero'
) ON CONFLICT (id) DO NOTHING;
