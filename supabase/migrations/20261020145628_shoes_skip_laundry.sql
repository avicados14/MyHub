-- Shoes are always available; preserve ownership, IDs, and historical snapshots.
create function myhub_private.keep_shoes_available() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.category='shoes' or new.garment_type='shoes' then new.laundry_status='clean'; end if;
 return new;
end $$;
revoke all on function myhub_private.keep_shoes_available() from public,anon,authenticated;
create trigger wardrobe_shoes_available before insert or update on public.wardrobe_items
for each row execute function myhub_private.keep_shoes_available();

-- Supply each row's owner to the existing immutable-identity trigger during backfill.
do $$
declare owner_id uuid; previous_claims text := current_setting('request.jwt.claims',true);
begin
 for owner_id in select distinct user_id from public.wardrobe_items
 where (category='shoes' or garment_type='shoes') and laundry_status='dirty' loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id)::text,true);
  update public.wardrobe_items set laundry_status='clean'
  where user_id=owner_id and (category='shoes' or garment_type='shoes') and laundry_status='dirty';
 end loop;
 perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
end $$;

alter table public.wardrobe_items add constraint wardrobe_shoes_always_clean
check ((category<>'shoes' and garment_type<>'shoes') or laundry_status='clean');

create or replace function myhub_private.snapshot_outfit() returns trigger
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if new.user_id is distinct from auth.uid() then raise exception 'Owner mismatch'; end if;
 -- Lock in deterministic order to prevent double-planning across devices.
 perform id from public.wardrobe_items where id=any(new.garment_ids) and user_id=auth.uid() order by id for update;
 select count(*),jsonb_agg(to_jsonb(w) order by w.garment_number) into n,new.garment_snapshot
 from public.wardrobe_items w where w.id=any(new.garment_ids) and w.user_id=auth.uid() and w.laundry_status='clean';
 if n<>cardinality(new.garment_ids) then raise exception 'Choose only your currently clean garments'; end if;
 update public.wardrobe_items set laundry_status='dirty' where id=any(new.garment_ids) and user_id=auth.uid() and category<>'shoes' and garment_type<>'shoes';
 return new;
end $$;
