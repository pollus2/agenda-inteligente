-- Prevent overlapping active appointments across public and staff bookings.
-- Run once in the Supabase SQL Editor after public_booking.sql.

begin;

create index if not exists appointments_overlap_lookup_idx
  on public.appointments (establishment_id, professional_id, start_at)
  where status in ('pending', 'confirmed', 'in_progress');

create or replace function public.guard_appointment_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_timezone text;
  target_local_date date;
  target_buffer integer;
  target_block_end timestamptz;
begin
  if new.status not in ('pending', 'confirmed', 'in_progress') then
    return new;
  end if;

  select coalesce(nullif(btrim(e.timezone), ''), 'America/Sao_Paulo')
    into target_timezone
  from public.establishments e
  where e.id = new.establishment_id;

  if not found then
    raise exception 'Establishment not found';
  end if;

  select coalesce(s.buffer_minutes, 0)
    into target_buffer
  from public.services s
  where s.id = new.service_id
    and s.establishment_id = new.establishment_id;

  target_local_date := (new.start_at at time zone target_timezone)::date;
  target_block_end := new.end_at + pg_catalog.make_interval(mins => coalesce(target_buffer, 0));

  if (target_block_end at time zone target_timezone)::date <> target_local_date then
    raise exception 'Appointments cannot cross the establishment local day';
  end if;

  -- Serialize all active bookings for the professional on the local day.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.professional_id::text || ':' || target_local_date::text,
      0
    )
  );

  if exists (
    select 1
    from public.appointments a
    left join public.services existing_service
      on existing_service.id = a.service_id
     and existing_service.establishment_id = a.establishment_id
    where a.establishment_id = new.establishment_id
      and a.professional_id = new.professional_id
      and a.id is distinct from new.id
      and a.status in ('pending', 'confirmed', 'in_progress')
      and new.start_at < a.end_at + pg_catalog.make_interval(mins => coalesce(existing_service.buffer_minutes, 0))
      and target_block_end > a.start_at
  ) then
    raise exception 'The selected time is no longer available';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_appointment_overlap() from public, anon, authenticated;

drop trigger if exists guard_appointment_overlap on public.appointments;
create trigger guard_appointment_overlap
before insert or update of establishment_id, professional_id, service_id, start_at, end_at, status
on public.appointments
for each row execute function public.guard_appointment_overlap();

commit;
