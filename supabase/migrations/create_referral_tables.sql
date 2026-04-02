-- Referral system tables

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  uses integer not null default 0,
  max_uses integer not null default 10,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_codes_user on public.referral_codes(user_id);
create index if not exists idx_referral_codes_code on public.referral_codes(code);

alter table public.referral_codes enable row level security;
create policy "Users can read own referral codes" on public.referral_codes for select using (auth.uid() = user_id);

create table if not exists public.referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  redeemed_by uuid not null references auth.users(id) on delete cascade,
  referred_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_redemptions_code on public.referral_redemptions(referral_code_id);
alter table public.referral_redemptions enable row level security;
create policy "Users can read own redemptions" on public.referral_redemptions for select using (auth.uid() = redeemed_by or auth.uid() = referred_by);
