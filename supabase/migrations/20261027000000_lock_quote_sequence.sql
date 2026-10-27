-- Security scan 2026-10-27: psb_quote_sequence had no RLS and the public anon
-- key had table grants, so anyone could rewind the counter and break quote
-- creation. The app uses the service-role key, which bypasses RLS.
alter table public.psb_quote_sequence enable row level security;
revoke all on table public.psb_quote_sequence from anon, authenticated;
