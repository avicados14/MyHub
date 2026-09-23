alter table public.myhub_private_access
  add column data_updated_at timestamptz not null default now();

comment on column public.myhub_private_access.data_updated_at is
  'Server timestamp of the latest accepted encrypted AppData revision.';
