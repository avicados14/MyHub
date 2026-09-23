create table public.myhub_private_access (
  id uuid primary key default gen_random_uuid(),
  encrypted_payload text not null check (char_length(encrypted_payload) between 100 and 16000),
  created_at timestamptz not null default now(),
  last_resolved_at timestamptz,
  revoked_at timestamptz
);

comment on table public.myhub_private_access is
  'Stores one revocable, client-encrypted MyHub access package. GitHub credentials are never stored as plaintext.';

alter table public.myhub_private_access enable row level security;

revoke all on table public.myhub_private_access from anon, authenticated;

create index myhub_private_access_active_created_idx
  on public.myhub_private_access (created_at desc)
  where revoked_at is null;
