-- Allow establishment administrators to safely edit public booking details.
-- Run after role_based_access.sql in the Supabase SQL Editor.

begin;

create or replace function public.update_establishment_booking_profile(
  target_establishment_id uuid,
  target_name text,
  target_phone text,
  target_slug text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not (select public.is_establishment_admin(target_establishment_id)) then
    raise exception 'Only establishment owners and managers can change public booking settings';
  end if;

  if target_name is null or pg_catalog.char_length(pg_catalog.btrim(target_name)) = 0
    or pg_catalog.char_length(pg_catalog.btrim(target_name)) > 120 then
    raise exception 'Invalid establishment name';
  end if;

  if target_phone is not null and pg_catalog.char_length(pg_catalog.btrim(target_phone)) > 40 then
    raise exception 'Invalid establishment phone';
  end if;

  if target_slug is null
    or pg_catalog.char_length(target_slug) < 3
    or pg_catalog.char_length(target_slug) > 60
    or target_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid booking slug';
  end if;

  -- Serialize slug changes so two admins cannot claim the same URL at once.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('establishment-slug:' || target_slug, 0)
  );

  if exists (
    select 1
    from public.establishments e
    where e.slug = target_slug
      and e.id <> target_establishment_id
  ) then
    raise exception 'Slug already in use';
  end if;

  update public.establishments
  set name = pg_catalog.btrim(target_name),
      phone = nullif(pg_catalog.btrim(target_phone), ''),
      slug = target_slug
  where id = target_establishment_id;

  if not found then
    raise exception 'Establishment not found';
  end if;
end;
$function$;

revoke all on function public.update_establishment_booking_profile(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.update_establishment_booking_profile(uuid, text, text, text) to authenticated;

commit;
