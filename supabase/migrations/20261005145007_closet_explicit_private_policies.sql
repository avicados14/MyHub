-- Explicit deny documents intentional service-only access and clears advisor notices.
create policy closet_identity_service_only on myhub_private.closet_identity
for all to anon,authenticated using(false) with check(false);
create policy closet_counter_trigger_only on myhub_private.garment_counters
for all to anon,authenticated using(false) with check(false);
-- Existing pairing records are already service-only and have no client policies.
create policy pairing_service_only on public.myhub_device_pairings
for all to anon,authenticated using(false) with check(false);
