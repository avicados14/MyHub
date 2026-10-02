-- Codes are 80-bit random capabilities. Only their hashes and client ciphertext are stored.
create table public.myhub_device_pairings (
  code_hash text primary key check (code_hash ~ '^[A-Za-z0-9+/]{43}=$'),
  access_id uuid not null unique references public.myhub_private_access(id) on delete cascade,
  encrypted_payload text not null check (length(encrypted_payload) between 100 and 16000),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);
alter table public.myhub_device_pairings enable row level security;
revoke all on table public.myhub_device_pairings from public, anon, authenticated;
grant select, insert, update, delete on table public.myhub_device_pairings to service_role;

create function public.manage_myhub_device_pairing(
  p_access_id uuid, p_write_hash text, p_code_hash text, p_payload text
) returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare expiry timestamptz;
begin
  -- Serialize generation/cancellation against access revocation and each other.
  perform 1 from public.myhub_private_access
    where id = p_access_id and revoked_at is null and write_token_hash = p_write_hash for update;
  if not found then return null; end if;
  delete from public.myhub_device_pairings where access_id = p_access_id or expires_at <= now();
  if p_code_hash is null then return now(); end if;
  insert into public.myhub_device_pairings(code_hash, access_id, encrypted_payload)
    values(p_code_hash, p_access_id, p_payload) returning expires_at into expiry;
  return expiry;
end;
$$;

create function public.redeem_myhub_device_pairing(p_code_hash text)
returns table(encrypted_payload text)
language sql security invoker set search_path = '' as $$
  delete from public.myhub_device_pairings as pairing
    using public.myhub_private_access as access
    where pairing.code_hash = p_code_hash and pairing.expires_at > now()
      and access.id = pairing.access_id and access.revoked_at is null
    returning pairing.encrypted_payload;
$$;
revoke all on function public.manage_myhub_device_pairing(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.redeem_myhub_device_pairing(text) from public, anon, authenticated;
grant execute on function public.manage_myhub_device_pairing(uuid, text, text, text) to service_role;
grant execute on function public.redeem_myhub_device_pairing(text) to service_role;
