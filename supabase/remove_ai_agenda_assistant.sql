-- Remove the unused AI agenda summary quota after disabling the feature in the app.
-- Run in the Supabase SQL Editor only if you also want to remove its database objects.

begin;

drop function if exists public.consume_ai_agenda_quota();
drop table if exists public.ai_agenda_usage;

commit;
