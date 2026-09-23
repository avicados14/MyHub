alter table public.myhub_private_access
  add column encrypted_data text,
  add column data_version bigint not null default 1,
  add column write_token_hash text;

alter table public.myhub_private_access
  add constraint myhub_private_access_encrypted_data_size
    check (encrypted_data is null or char_length(encrypted_data) between 100 and 10000000),
  add constraint myhub_private_access_write_token_hash_shape
    check (write_token_hash is null or write_token_hash ~ '^[A-Za-z0-9_-]{43}$');

comment on column public.myhub_private_access.encrypted_data is
  'Client-encrypted AppData. Supabase stores ciphertext and cannot decrypt the user record.';
comment on column public.myhub_private_access.data_version is
  'Monotonic optimistic-concurrency version for cross-device writes.';
comment on column public.myhub_private_access.write_token_hash is
  'SHA-256 of a write capability derived from the client-only link key.';
