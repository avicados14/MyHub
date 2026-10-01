-- Safe against live data: all successful and failed replacements roll back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
set local role service_role;
do $$
declare
  before_ids uuid[];
  replacement_id uuid;
  insertion_failed boolean := false;
begin
  select array_agg(id order by id) into before_ids
    from public.myhub_private_access where revoked_at is null;
  begin
    perform * from public.replace_myhub_private_access('too short', repeat('x', 100), repeat('a', 43));
  exception when check_violation then
    insertion_failed := true;
  end;
  if not insertion_failed then raise exception 'Expected insert constraint failure'; end if;
  if before_ids is distinct from (select array_agg(id order by id) from public.myhub_private_access where revoked_at is null) then
    raise exception 'Failed replacement changed active links';
  end if;

  select id into replacement_id from public.replace_myhub_private_access(repeat('x', 100), repeat('x', 100), repeat('a', 43));
  if (select count(*) from public.myhub_private_access where revoked_at is null) <> 1 then
    raise exception 'Replacement must leave exactly one active link';
  end if;
  if not exists (select 1 from public.myhub_private_access where id = replacement_id and revoked_at is null and data_version = 1) then
    raise exception 'Replacement missing';
  end if;
end;
$$;
reset role;
select 'rollback and successful replacement assertions passed' as result;
rollback;
