revoke all privileges on table public.myhub_private_access from anon, authenticated;

comment on table public.myhub_private_access is
  'Opaque encrypted MyHub access and AppData documents. Direct browser grants are revoked; only the Edge Function service role may access rows.';
