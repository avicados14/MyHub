-- Bind authorization to an immutable Auth session, not refreshable account metadata.
create table myhub_private.closet_sessions (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 access_id uuid not null references public.myhub_private_access(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index closet_sessions_access_idx on myhub_private.closet_sessions(access_id);
create index closet_sessions_user_idx on myhub_private.closet_sessions(user_id);
alter table myhub_private.closet_sessions enable row level security;
create policy service_only on myhub_private.closet_sessions to anon,authenticated using(false) with check(false);
revoke all on myhub_private.closet_sessions from public,anon,authenticated;
grant select,insert on myhub_private.closet_sessions to service_role;
create function public.closet_bind_session(new_session_id uuid,new_user_id uuid,new_access_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from myhub_private.closet_identity i where i.scope='avicados14/MyHub-Data' and i.user_id=new_user_id)
 or not exists(select 1 from public.myhub_private_access a where a.id=new_access_id and a.revoked_at is null)
 then raise exception 'Inactive closet identity or capability';end if;
 insert into myhub_private.closet_sessions(session_id,user_id,access_id)
 values(new_session_id,new_user_id,new_access_id) on conflict(session_id) do nothing;
 if not exists(select 1 from myhub_private.closet_sessions s where s.session_id=new_session_id and s.user_id=new_user_id and s.access_id=new_access_id)
 then raise exception 'Session binding is immutable';end if;
end $$;
revoke all on function public.closet_bind_session(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.closet_bind_session(uuid,uuid,uuid) to service_role;
-- Definer is restricted to the private authorization lookup; no user data is returned.
create or replace function myhub_private.closet_session_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from myhub_private.closet_sessions s
 join auth.sessions live on live.id=s.session_id and live.user_id=s.user_id
 join public.myhub_private_access a on a.id=s.access_id and a.revoked_at is null
 join myhub_private.closet_identity i on i.user_id=s.user_id
 where s.user_id=(select auth.uid()) and s.session_id=((select auth.jwt())->>'session_id')::uuid)
$$;
