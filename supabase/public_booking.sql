-- Public customer booking flow for Agenda Inteligente.
-- This script exposes only limited booking information through RPC functions.
-- Review the functions and run this file in the Supabase SQL Editor.

begin;

grant usage on schema public to anon, authenticated;

-- A public booking has no signed-in creator account.
alter table public.appointments
  alter column created_by drop not null;

create index if not exists appointments_public_availability_idx
  on public.appointments (professional_id, start_at)
  where status in ('pending', 'confirmed', 'in_progress');

create or replace function public.get_public_booking_data(target_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  target_establishment public.establishments%rowtype;
begin
  select e.*
    into target_establishment
  from public.establishments e
  where e.slug = btrim(target_slug)
  limit 1;

  if not found then
    return null;
  end if;

  return pg_catalog.jsonb_build_object(
    'establishment', pg_catalog.jsonb_build_object(
      'name', target_establishment.name,
      'slug', target_establishment.slug,
      'timezone', coalesce(nullif(btrim(target_establishment.timezone), ''), 'America/Sao_Paulo'),
      'phone', target_establishment.phone
    ),
    'professionals', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'specialty', p.specialty
        ) order by p.name
      )
      from public.professionals p
      where p.establishment_id = target_establishment.id
        and p.active
    ), '[]'::jsonb),
    'services', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'category', s.category,
          'description', s.description,
          'duration_minutes', s.duration_minutes,
          'buffer_minutes', s.buffer_minutes,
          'price', s.price
        ) order by s.name
      )
      from public.services s
      where s.establishment_id = target_establishment.id
        and s.active
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.get_public_available_slots(
  target_slug text,
  target_professional_id uuid,
  target_service_id uuid,
  target_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  target_establishment_id uuid;
  target_timezone text;
  target_duration integer;
  target_buffer integer;
  opening_time time;
  closing_time time;
  opening_minute integer;
  closing_minute integer;
  slot_minute integer;
  local_start timestamp without time zone;
  slot_start timestamptz;
  slot_block_end timestamptz;
  slots jsonb := '[]'::jsonb;
begin
  select e.id, coalesce(nullif(btrim(e.timezone), ''), 'America/Sao_Paulo')
    into target_establishment_id, target_timezone
  from public.establishments e
  where e.slug = btrim(target_slug)
  limit 1;

  if not found or target_date is null then
    return slots;
  end if;

  if target_date < (pg_catalog.now() at time zone target_timezone)::date
    or target_date > ((pg_catalog.now() at time zone target_timezone)::date + 120) then
    return slots;
  end if;

  if not exists (
    select 1 from public.professionals p
    where p.id = target_professional_id
      and p.establishment_id = target_establishment_id
      and p.active
  ) then
    return slots;
  end if;

  select s.duration_minutes, s.buffer_minutes
    into target_duration, target_buffer
  from public.services s
  where s.id = target_service_id
    and s.establishment_id = target_establishment_id
    and s.active;

  if not found then
    return slots;
  end if;

  select h.start_time, h.end_time
    into opening_time, closing_time
  from public.business_hours h
  where h.establishment_id = target_establishment_id
    and h.professional_id = target_professional_id
    and h.weekday = extract(dow from target_date)::integer
    and not h.is_day_off;

  if not found then
    return slots;
  end if;

  opening_minute := extract(hour from opening_time)::integer * 60 + extract(minute from opening_time)::integer;
  closing_minute := extract(hour from closing_time)::integer * 60 + extract(minute from closing_time)::integer;

  for slot_minute in opening_minute..(closing_minute - target_duration - target_buffer) by 15 loop
    local_start := target_date::timestamp + pg_catalog.make_interval(mins => slot_minute);
    slot_start := local_start at time zone target_timezone;
    slot_block_end := slot_start + pg_catalog.make_interval(mins => target_duration + target_buffer);

    if slot_start > pg_catalog.now()
      and not exists (
        select 1
        from public.appointments a
        left join public.services booked_service
          on booked_service.id = a.service_id
         and booked_service.establishment_id = a.establishment_id
        where a.establishment_id = target_establishment_id
          and a.professional_id = target_professional_id
          and a.status in ('pending', 'confirmed', 'in_progress')
          and a.start_at < slot_block_end
          and a.end_at + pg_catalog.make_interval(mins => coalesce(booked_service.buffer_minutes, 0)) > slot_start
      ) then
      slots := slots || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'time', pg_catalog.to_char(local_start, 'HH24:MI'),
        'start_at', slot_start
      ));
    end if;
  end loop;

  return slots;
end;
$function$;

create or replace function public.create_public_appointment(
  target_slug text,
  target_client_name text,
  target_client_phone text,
  target_client_email text,
  target_professional_id uuid,
  target_service_id uuid,
  target_start_at timestamptz,
  target_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_establishment public.establishments%rowtype;
  target_professional public.professionals%rowtype;
  target_service public.services%rowtype;
  target_timezone text;
  local_start timestamp without time zone;
  local_end_with_buffer timestamp without time zone;
  slot_start timestamptz;
  appointment_end timestamptz;
  booking_block_end timestamptz;
  phone_digits text;
  target_client_id uuid;
  target_appointment_id uuid;
begin
  if target_slug is null or btrim(target_slug) = ''
    or target_client_name is null or btrim(target_client_name) = ''
    or pg_catalog.char_length(btrim(target_client_name)) > 160
    or target_client_phone is null
    or pg_catalog.char_length(target_client_phone) > 40
    or target_client_email is not null and pg_catalog.char_length(target_client_email) > 254
    or target_notes is not null and pg_catalog.char_length(target_notes) > 1000 then
    raise exception 'Invalid booking details';
  end if;

  phone_digits := pg_catalog.regexp_replace(target_client_phone, '[^0-9]', '', 'g');
  if pg_catalog.char_length(phone_digits) < 8 then
    raise exception 'A valid phone number is required';
  end if;

  if nullif(btrim(target_client_email), '') is not null
    and btrim(target_client_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Invalid email address';
  end if;

  if target_start_at is null then
    raise exception 'Choose an available time';
  end if;

  select e.*
    into target_establishment
  from public.establishments e
  where e.slug = btrim(target_slug)
  limit 1;
  if not found then
    raise exception 'Establishment not found';
  end if;
  target_timezone := coalesce(nullif(btrim(target_establishment.timezone), ''), 'America/Sao_Paulo');

  select p.*
    into target_professional
  from public.professionals p
  where p.id = target_professional_id
    and p.establishment_id = target_establishment.id
    and p.active;
  if not found then
    raise exception 'Professional is unavailable';
  end if;

  select s.*
    into target_service
  from public.services s
  where s.id = target_service_id
    and s.establishment_id = target_establishment.id
    and s.active;
  if not found then
    raise exception 'Service is unavailable';
  end if;

  local_start := target_start_at at time zone target_timezone;
  if target_start_at <= pg_catalog.now()
    or target_start_at > pg_catalog.now() + interval '120 days'
    or extract(second from local_start) <> 0
    then
    raise exception 'Choose a valid future time';
  end if;

  appointment_end := target_start_at + pg_catalog.make_interval(mins => target_service.duration_minutes);
  booking_block_end := target_start_at + pg_catalog.make_interval(mins => target_service.duration_minutes + target_service.buffer_minutes);
  local_end_with_buffer := booking_block_end at time zone target_timezone;

  if local_end_with_buffer::date <> local_start::date then
    raise exception 'The selected time is outside business hours';
  end if;

  if not exists (
    select 1
    from public.business_hours h
    where h.establishment_id = target_establishment.id
      and h.professional_id = target_professional.id
      and h.weekday = extract(dow from local_start)::integer
      and not h.is_day_off
      and local_start::time >= h.start_time
      and local_end_with_buffer::time <= h.end_time
      and mod(
        (extract(hour from local_start)::integer * 60 + extract(minute from local_start)::integer)
        - (extract(hour from h.start_time)::integer * 60 + extract(minute from h.start_time)::integer),
        15
      ) = 0
  ) then
    raise exception 'The selected time is outside business hours';
  end if;

  -- Serialize bookings for this professional and local calendar day.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_professional.id::text || ':' || local_start::date::text, 0)
  );

  if exists (
    select 1
    from public.appointments a
    left join public.services booked_service
      on booked_service.id = a.service_id
     and booked_service.establishment_id = a.establishment_id
    where a.establishment_id = target_establishment.id
      and a.professional_id = target_professional.id
      and a.status in ('pending', 'confirmed', 'in_progress')
      and a.start_at < booking_block_end
      and a.end_at + pg_catalog.make_interval(mins => coalesce(booked_service.buffer_minutes, 0)) > target_start_at
  ) then
    raise exception 'The selected time is no longer available';
  end if;

  select c.id
    into target_client_id
  from public.clients c
  where c.establishment_id = target_establishment.id
    and (
      (nullif(btrim(target_client_email), '') is not null and pg_catalog.lower(pg_catalog.btrim(c.email)) = pg_catalog.lower(pg_catalog.btrim(target_client_email)))
      or pg_catalog.regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = phone_digits
    )
  order by case
    when nullif(btrim(target_client_email), '') is not null and pg_catalog.lower(pg_catalog.btrim(c.email)) = pg_catalog.lower(pg_catalog.btrim(target_client_email)) then 0
    else 1
  end
  limit 1;

  if target_client_id is null then
    insert into public.clients (establishment_id, name, phone, email)
    values (
      target_establishment.id,
      btrim(target_client_name),
      btrim(target_client_phone),
      nullif(pg_catalog.lower(btrim(target_client_email)), '')
    )
    returning id into target_client_id;
  end if;

  insert into public.appointments (
    establishment_id,
    client_id,
    professional_id,
    service_id,
    start_at,
    end_at,
    price,
    status,
    notes,
    created_by
  ) values (
    target_establishment.id,
    target_client_id,
    target_professional.id,
    target_service.id,
    target_start_at,
    appointment_end,
    target_service.price,
    'pending',
    nullif(btrim(target_notes), ''),
    null
  )
  returning id into target_appointment_id;

  return pg_catalog.jsonb_build_object(
    'appointment_id', target_appointment_id,
    'start_at', target_start_at,
    'status', 'pending'
  );
end;
$function$;

revoke all on function public.get_public_booking_data(text) from public, anon, authenticated;
revoke all on function public.get_public_available_slots(text, uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.create_public_appointment(text, text, text, text, uuid, uuid, timestamptz, text) from public, anon, authenticated;

grant execute on function public.get_public_booking_data(text) to anon, authenticated;
grant execute on function public.get_public_available_slots(text, uuid, uuid, date) to anon, authenticated;
grant execute on function public.create_public_appointment(text, text, text, text, uuid, uuid, timestamptz, text) to anon, authenticated;

commit;
