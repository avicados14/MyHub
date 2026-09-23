create policy "deny direct client access"
on public.myhub_private_access
for all
to anon, authenticated
using (false)
with check (false);

comment on policy "deny direct client access" on public.myhub_private_access is
  'All browser access must pass through the myhub-private-access Edge Function; its service-role client bypasses RLS.';
