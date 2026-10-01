-- Keep replacement atomic, including concurrent create/revoke/push requests.
-- This application intentionally has one repository-wide active access link.
create or replace function public.replace_myhub_private_access(
  new_encrypted_payload text,
  new_encrypted_data text,
  new_write_token_hash text
)
returns table (id uuid, data_version bigint, data_updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serialize writers even when there are no active rows to lock.
  lock table public.myhub_private_access in share row exclusive mode;

  update public.myhub_private_access
    set revoked_at = now()
    where revoked_at is null;

  return query
    insert into public.myhub_private_access as replacement
      (encrypted_payload, encrypted_data, write_token_hash)
    values (new_encrypted_payload, new_encrypted_data, new_write_token_hash)
    returning replacement.id, replacement.data_version, replacement.data_updated_at;
end;
$$;

revoke all on function public.replace_myhub_private_access(text, text, text)
  from public, anon, authenticated;
grant execute on function public.replace_myhub_private_access(text, text, text)
  to service_role;
