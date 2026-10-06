-- Additive, isolated from encrypted AppData and the existing capability broker.
create schema if not exists myhub_private;
revoke all on schema myhub_private from public, anon;
grant usage on schema myhub_private to authenticated, service_role;
create table myhub_private.closet_identity (
  scope text primary key,
  email text not null unique,
  user_id uuid unique references auth.users(id)
);
alter table myhub_private.closet_identity enable row level security;
grant select,update on myhub_private.closet_identity to service_role;
insert into myhub_private.closet_identity(scope,email)
values ('avicados14/MyHub-Data', gen_random_uuid()::text || '@myhub.invalid');
-- Service-only accessor avoids exposing the private schema through PostgREST.
create function public.closet_identity_record(new_user_id uuid default null)
returns table(email text, user_id uuid)
language plpgsql security invoker set search_path='' as $$
begin
  if new_user_id is not null then
    update myhub_private.closet_identity i set user_id=new_user_id
    where i.scope='avicados14/MyHub-Data' and (i.user_id is null or i.user_id=new_user_id);
    if not found then raise exception 'Identity mismatch'; end if;
  end if;
  return query select i.email,i.user_id from myhub_private.closet_identity i where i.scope='avicados14/MyHub-Data';
end $$;
revoke all on function public.closet_identity_record(uuid) from public,anon,authenticated;
grant execute on function public.closet_identity_record(uuid) to service_role;

-- The signed claim is server-managed app_metadata, never user_metadata.
-- Definer is needed only to inspect the otherwise inaccessible capability record.
create function myhub_private.closet_session_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.myhub_private_access a
 join myhub_private.closet_identity i on i.user_id=(select auth.uid())
 where a.id::text=(select auth.jwt())->'app_metadata'->>'myhub_access_id' and a.revoked_at is null)
$$;
revoke all on function myhub_private.closet_session_active() from public,anon;
grant execute on function myhub_private.closet_session_active() to authenticated;
create table myhub_private.garment_counters(user_id uuid primary key references auth.users(id), last_number integer not null default 0);
alter table myhub_private.garment_counters enable row level security;

create table public.wardrobe_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 garment_number integer not null check(garment_number>0),
 name text not null check(char_length(name) between 1 and 120),
 category text not null check(category in ('tops','bottoms','outerwear','shoes','accessories','one-piece','activewear','other')),
 primary_color text not null default 'Unknown' check(char_length(primary_color) between 1 and 60),
 image_path text not null check(image_path like user_id::text || '/%' and image_path not like '%..%'),
 laundry_status text not null default 'clean' check(laundry_status in ('clean','dirty')),
 content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),
 dhash text check(dhash ~ '^[01]{64}$'),
 import_key uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,garment_number), unique(user_id,import_key)
);
create index wardrobe_items_owner_hash on public.wardrobe_items(user_id,content_hash);
alter table public.wardrobe_items enable row level security;
revoke all on public.wardrobe_items from anon,authenticated;
grant select,insert,update,delete on public.wardrobe_items to authenticated;
create policy closet_owned_items on public.wardrobe_items for all to authenticated
using(user_id=(select auth.uid()) and (select myhub_private.closet_session_active()))
with check(user_id=(select auth.uid()) and (select myhub_private.closet_session_active()));

create function myhub_private.number_garment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.user_id is distinct from auth.uid() then raise exception 'Owner mismatch'; end if;
 if tg_op='INSERT' then
  insert into myhub_private.garment_counters(user_id,last_number) values(new.user_id,1)
  on conflict(user_id) do update set last_number=myhub_private.garment_counters.last_number+1
  returning last_number into new.garment_number;
 else
  if new.user_id<>old.user_id or new.id<>old.id or new.garment_number<>old.garment_number or new.import_key<>old.import_key then raise exception 'Garment identity is immutable'; end if;
 end if;
 new.updated_at=now();return new;
end $$;
revoke all on function myhub_private.number_garment() from public,anon,authenticated;
create trigger wardrobe_number before insert or update on public.wardrobe_items for each row execute function myhub_private.number_garment();

create table public.outfit_plans (
 id uuid primary key,
 user_id uuid not null default auth.uid() references auth.users(id),
 planned_date date not null,
 occasion text not null check(occasion in ('Everyday','School','Office','Date night','Weekend','Travel')),
 title text not null check(char_length(title) between 1 and 160),
 note text check(char_length(note)<=1000),
 garment_ids uuid[] not null check(cardinality(garment_ids) between 1 and 20),
 garment_snapshot jsonb not null,
 created_at timestamptz not null default now()
);
create index outfit_plans_owner_date on public.outfit_plans(user_id,planned_date desc);
alter table public.outfit_plans enable row level security;
revoke all on public.outfit_plans from anon,authenticated;
grant select,insert,delete on public.outfit_plans to authenticated;
create policy closet_owned_plans on public.outfit_plans for all to authenticated
using(user_id=(select auth.uid()) and (select myhub_private.closet_session_active()))
with check(user_id=(select auth.uid()) and (select myhub_private.closet_session_active()));
create function myhub_private.snapshot_outfit() returns trigger
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if new.user_id is distinct from auth.uid() then raise exception 'Owner mismatch'; end if;
 -- Lock in deterministic order to prevent double-planning across devices.
 perform id from public.wardrobe_items where id=any(new.garment_ids) and user_id=auth.uid() order by id for update;
 select count(*),jsonb_agg(to_jsonb(w) order by w.garment_number) into n,new.garment_snapshot
 from public.wardrobe_items w where w.id=any(new.garment_ids) and w.user_id=auth.uid() and w.laundry_status='clean';
 if n<>cardinality(new.garment_ids) then raise exception 'Choose only your currently clean garments'; end if;
 update public.wardrobe_items set laundry_status='dirty' where id=any(new.garment_ids) and user_id=auth.uid();
 return new;
end $$;
revoke all on function myhub_private.snapshot_outfit() from public,anon,authenticated;
create trigger outfit_snapshot before insert on public.outfit_plans for each row execute function myhub_private.snapshot_outfit();

create function public.closet_save_plan(plan_id uuid, plan_date date, plan_occasion text, plan_title text, plan_note text, item_ids uuid[])
returns public.outfit_plans language plpgsql security invoker set search_path='' as $$
declare result public.outfit_plans;
begin
 -- Serialize retries on an identical operation ID before checking existence.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(plan_id::text,0));
 select * into result from public.outfit_plans where id=plan_id and user_id=auth.uid();
 if found then return result; end if;
 insert into public.outfit_plans(id,planned_date,occasion,title,note,garment_ids,garment_snapshot)
 values(plan_id,plan_date,plan_occasion,plan_title,plan_note,item_ids,'[]') returning * into result;
 return result;
end $$;
revoke all on function public.closet_save_plan(uuid,date,text,text,text,uuid[]) from public,anon;
grant execute on function public.closet_save_plan(uuid,date,text,text,text,uuid[]) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('wardrobe','wardrobe',false,8388608,array['image/jpeg','image/png','image/webp','image/gif']);
create policy closet_private_images on storage.objects for all to authenticated
using(bucket_id='wardrobe' and (storage.foldername(name))[1]=(select auth.uid())::text and (select myhub_private.closet_session_active()))
with check(bucket_id='wardrobe' and (storage.foldername(name))[1]=(select auth.uid())::text and (select myhub_private.closet_session_active()));
