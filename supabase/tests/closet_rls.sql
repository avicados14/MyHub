begin;
create temporary table closet_fixture as select gen_random_uuid() as owner_id,gen_random_uuid() as other_id,gen_random_uuid() as access_id,gen_random_uuid() as item_id,gen_random_uuid() as plan_id,gen_random_uuid() as session_id,gen_random_uuid() as replacement_access_id,gen_random_uuid() as unbound_session_id;
grant select on closet_fixture to authenticated;
insert into auth.users(id) select owner_id from closet_fixture union all select other_id from closet_fixture;
insert into myhub_private.closet_identity(scope,email,user_id) select owner_id::text,owner_id::text||'@test.invalid',owner_id from closet_fixture;
insert into public.myhub_private_access(id,encrypted_payload) select access_id,repeat('x',100) from closet_fixture;
insert into auth.sessions(id,user_id) select session_id,owner_id from closet_fixture union all select unbound_session_id,owner_id from closet_fixture;
insert into myhub_private.closet_sessions(session_id,user_id,access_id) select session_id,owner_id,access_id from closet_fixture;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',session_id,'app_metadata',jsonb_build_object('myhub_access_id',access_id))::text,true) is not null as configured from closet_fixture;
set local role authenticated;
insert into public.wardrobe_items(id,user_id,name,category,image_path,content_hash,import_key)
select item_id,owner_id,'Fixture top','tops',owner_id::text||'/test.png',repeat('a',64),gen_random_uuid() from closet_fixture;
do $$ begin
 if (select garment_number from public.wardrobe_items where id=(select item_id from closet_fixture))<>1 then raise exception 'First number failed';end if;
 begin
 update public.wardrobe_items set garment_number=42 where id=(select item_id from closet_fixture);
 raise exception 'Number mutation unexpectedly allowed';
 exception when raise_exception then if sqlerrm='Number mutation unexpectedly allowed' then raise;end if;end;
 begin
 insert into public.wardrobe_items(user_id,name,category,image_path,content_hash,import_key) select other_id,'Intrusion','tops',other_id::text||'/test.png',repeat('b',64),gen_random_uuid() from closet_fixture;
 raise exception 'Foreign insert unexpectedly allowed';
 exception when insufficient_privilege or raise_exception then if sqlerrm='Foreign insert unexpectedly allowed' then raise;end if;end;
 begin
 update public.wardrobe_items set user_id=(select other_id from closet_fixture) where id=(select item_id from closet_fixture);
 raise exception 'Ownership transfer unexpectedly allowed';
 exception when check_violation or insufficient_privilege or raise_exception then if sqlerrm='Ownership transfer unexpectedly allowed' then raise;end if;end;
end $$;
select (public.closet_save_plan(plan_id,current_date,'School','Test outfit','Fixture',array[item_id])).id is not null as saved from closet_fixture;
select (public.closet_save_plan(plan_id,current_date,'School','Test outfit','Fixture',array[item_id])).id is not null as retry_saved from closet_fixture;
do $$ begin
 if (select laundry_status from public.wardrobe_items where id=(select item_id from closet_fixture))<>'dirty' then raise exception 'Dirty transition failed';end if;
 if (select count(*) from public.outfit_plans)<>1 then raise exception 'Retry duplicated plan';end if;
 if (select garment_snapshot->0->>'name' from public.outfit_plans)<>'Fixture top' then raise exception 'Snapshot missing';end if;
 begin
 perform public.closet_save_plan(gen_random_uuid(),current_date,'School','Dirty retry','',array[(select item_id from closet_fixture)]);
 raise exception 'Dirty plan unexpectedly allowed';
 exception when raise_exception then if sqlerrm='Dirty plan unexpectedly allowed' then raise;end if;end;
 begin
 update public.outfit_plans set garment_snapshot='[]';raise exception 'Snapshot mutation allowed';
 exception when insufficient_privilege then null;end;
end $$;
update public.wardrobe_items set laundry_status='clean',name='Edited top';
do $$ begin
 if (select garment_snapshot->0->>'name' from public.outfit_plans)<>'Fixture top' then raise exception 'Snapshot changed';end if;
 if (select laundry_status from public.wardrobe_items)<>'clean' then raise exception 'Laundry failed';end if;
end $$;
delete from public.wardrobe_items where id=(select item_id from closet_fixture);
insert into public.wardrobe_items(user_id,name,category,image_path,content_hash,import_key)
select owner_id,'Second fixture','tops',owner_id::text||'/second.png',repeat('c',64),gen_random_uuid() from closet_fixture;
do $$ begin
 if (select garment_number from public.wardrobe_items)<>2 then raise exception 'Deleted garment number was reused';end if;
end $$;
insert into storage.objects(bucket_id,name) select 'wardrobe',owner_id::text||'/fixture.png' from closet_fixture;
do $$ begin
 begin
 insert into storage.objects(bucket_id,name) select 'wardrobe',other_id::text||'/intrusion.png' from closet_fixture;
 raise exception 'Foreign storage insert allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated','session_id',session_id,'app_metadata',jsonb_build_object('myhub_access_id',access_id))::text,true) is not null as other_configured from closet_fixture;
do $$ begin
 if exists(select 1 from public.wardrobe_items) or exists(select 1 from public.outfit_plans) or exists(select 1 from storage.objects where bucket_id='wardrobe') then raise exception 'Cross-user read leak';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',unbound_session_id,'app_metadata',jsonb_build_object('myhub_access_id',access_id))::text,true) is not null as unbound from closet_fixture;
do $$ begin
 if exists(select 1 from public.wardrobe_items) then raise exception 'Unbound Auth session gained access';end if;
end $$;
reset role;
update public.myhub_private_access set revoked_at=now() where id=(select access_id from closet_fixture);
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',session_id,'app_metadata',jsonb_build_object('myhub_access_id',access_id))::text,true) is not null as revoked_configured from closet_fixture;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.wardrobe_items) or exists(select 1 from storage.objects where bucket_id='wardrobe') then raise exception 'Revocation failed';end if;
end $$;
reset role;
-- Simulate refresh after another device updates account metadata to a new active link.
insert into public.myhub_private_access(id,encrypted_payload) select replacement_access_id,repeat('x',100) from closet_fixture;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',session_id,'app_metadata',jsonb_build_object('myhub_access_id',replacement_access_id))::text,true) is not null as refreshed from closet_fixture;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.wardrobe_items) or exists(select 1 from storage.objects where bucket_id='wardrobe') then raise exception 'Refresh resurrected revoked access';end if;
 begin
 perform public.closet_bind_session(gen_random_uuid(),(select owner_id from closet_fixture),(select replacement_access_id from closet_fixture));
 raise exception 'Client bound a session';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: ownership, numbering, snapshots, atomic planning, retry, laundry, storage, revocation and refresh isolation' as result;
rollback;
