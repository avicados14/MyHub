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
insert into public.wardrobe_items(id,user_id,name,category,garment_type,import_key)
select item_id,owner_id,'Photo-free fixture','tops','long-sleeve',gen_random_uuid() from closet_fixture;
do $$ begin
 if (select garment_number from public.wardrobe_items)<>1 then raise exception 'Text numbering failed'; end if;
 begin
  update public.wardrobe_items set image_path=user_id::text||'/photo.jpg';
  raise exception 'Unpaired photo accepted';
 exception when check_violation then null; end;
 begin
  update public.wardrobe_items set image_path=(select other_id::text from closet_fixture)||'/photo.jpg',content_hash=repeat('a',64);
  raise exception 'Foreign photo path accepted';
 exception when check_violation then null; end;
end $$;
select (public.closet_save_plan(plan_id,current_date,'School','Text outfit','Tank required',array[item_id])).id is not null as saved from closet_fixture;
select (public.closet_save_plan(plan_id,current_date,'School','Text outfit','Tank required',array[item_id])).id is not null as retry_saved from closet_fixture;
update public.wardrobe_items set image_path=user_id::text||'/later-photo.jpg',content_hash=repeat('b',64);
do $$ begin
 if (select garment_number from public.wardrobe_items)<>1 then raise exception 'Photo changed number'; end if;
 if (select laundry_status from public.wardrobe_items)<>'dirty' then raise exception 'Photo changed laundry'; end if;
 if (select count(*) from public.outfit_plans)<>1 then raise exception 'Plan retry duplicated'; end if;
 if (select garment_snapshot->0->>'image_path' from public.outfit_plans) is not null then raise exception 'Historical photo changed'; end if;
 if (select garment_snapshot->0->>'garment_type' from public.outfit_plans)<>'long-sleeve' then raise exception 'Type snapshot missing'; end if;
end $$;
update public.wardrobe_items set laundry_status='clean';
do $$ begin
 if (select laundry_status from public.wardrobe_items)<>'clean' then raise exception 'Laundry failed'; end if;
end $$;
reset role;
insert into myhub_private.closet_identity(scope,email,user_id) select other_id::text,other_id::text||'@test.invalid',other_id from closet_fixture;
insert into auth.sessions(id,user_id) select gen_random_uuid(),other_id from closet_fixture;
insert into myhub_private.closet_sessions(session_id,user_id,access_id) select s.id,f.other_id,f.access_id from closet_fixture f join auth.sessions s on s.user_id=f.other_id;
select set_config('request.jwt.claims',jsonb_build_object('sub',f.other_id,'role','authenticated','session_id',s.id)::text,true) is not null as configured from closet_fixture f join auth.sessions s on s.user_id=f.other_id;
set local role authenticated;
do $$ begin
 if not myhub_private.closet_session_active() then raise exception 'Other user session fixture invalid'; end if;
 if (select count(*) from public.wardrobe_items)<>0 then raise exception 'Foreign text/photo item visible'; end if;
 if (select count(*) from public.outfit_plans)<>0 then raise exception 'Foreign snapshot visible'; end if;
end $$;
rollback;
