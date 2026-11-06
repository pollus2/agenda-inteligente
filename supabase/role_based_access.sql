-- Role-based access for Agenda Inteligente.
-- Review and run this script in Supabase SQL Editor after confirming that every
-- professional account is linked through professionals.user_id.

begin;

create or replace function public.is_establishment_admin(target_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.establishment_members m
    where m.establishment_id = target_establishment_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'manager')
  );
$function$;

create or replace function public.is_linked_professional(
  target_establishment_id uuid,
  target_professional_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.establishment_members m
    join public.professionals p
      on p.establishment_id = m.establishment_id
     and p.user_id = m.user_id
    where m.establishment_id = target_establishment_id
      and p.id = target_professional_id
      and m.user_id = (select auth.uid())
      and m.role = 'professional'
  );
$function$;

revoke all on function public.is_establishment_admin(uuid) from public, anon;
revoke all on function public.is_linked_professional(uuid, uuid) from public, anon;
grant execute on function public.is_establishment_admin(uuid) to authenticated;
grant execute on function public.is_linked_professional(uuid, uuid) to authenticated;

create or replace function public.guard_professional_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Keep trusted database administration and service-role maintenance possible.
  if (select auth.uid()) is null then
    return new;
  end if;

  if (select public.is_establishment_admin(old.establishment_id)) then
    return new;
  end if;

  if not (select public.is_linked_professional(old.establishment_id, old.professional_id)) then
    raise exception 'Not authorized to update this appointment';
  end if;

  if row(
    new.id, new.establishment_id, new.client_id, new.professional_id,
    new.service_id, new.start_at, new.end_at, new.price, new.notes,
    new.created_by, new.created_at
  ) is distinct from row(
    old.id, old.establishment_id, old.client_id, old.professional_id,
    old.service_id, old.start_at, old.end_at, old.price, old.notes,
    old.created_by, old.created_at
  ) then
    raise exception 'Professionals may only change appointment status';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_professional_appointment_update() from public, anon, authenticated;

drop trigger if exists guard_professional_appointment_update on public.appointments;
create trigger guard_professional_appointment_update
before update on public.appointments
for each row execute function public.guard_professional_appointment_update();

drop policy if exists "Members manage appointments" on public.appointments;
drop policy if exists "Admins manage appointments" on public.appointments;
drop policy if exists "Professionals read own appointments" on public.appointments;
drop policy if exists "Professionals update own appointment status" on public.appointments;

create policy "Admins manage appointments"
on public.appointments for all to authenticated
using ((select public.is_establishment_admin(establishment_id)))
with check ((select public.is_establishment_admin(establishment_id)));

create policy "Professionals read own appointments"
on public.appointments for select to authenticated
using ((select public.is_linked_professional(establishment_id, professional_id)));

create policy "Professionals update own appointment status"
on public.appointments for update to authenticated
using ((select public.is_linked_professional(establishment_id, professional_id)))
with check ((select public.is_linked_professional(establishment_id, professional_id)));

drop policy if exists "Members manage clients" on public.clients;
drop policy if exists "Admins manage clients" on public.clients;
drop policy if exists "Professionals read clients from own appointments" on public.clients;

create policy "Admins manage clients"
on public.clients for all to authenticated
using ((select public.is_establishment_admin(establishment_id)))
with check ((select public.is_establishment_admin(establishment_id)));

create policy "Professionals read clients from own appointments"
on public.clients for select to authenticated
using (
  exists (
    select 1
    from public.appointments a
    where a.establishment_id = clients.establishment_id
      and a.client_id = clients.id
      and (select public.is_linked_professional(a.establishment_id, a.professional_id))
  )
);

drop policy if exists "Members manage professionals" on public.professionals;
drop policy if exists "Admins manage professionals" on public.professionals;
drop policy if exists "Professionals read own profile" on public.professionals;

create policy "Admins manage professionals"
on public.professionals for all to authenticated
using ((select public.is_establishment_admin(establishment_id)))
with check ((select public.is_establishment_admin(establishment_id)));

create policy "Professionals read own profile"
on public.professionals for select to authenticated
using ((select public.is_linked_professional(establishment_id, id)));

drop policy if exists "Members manage services" on public.services;
drop policy if exists "Admins manage services" on public.services;
drop policy if exists "Professionals read services from own appointments" on public.services;

create policy "Admins manage services"
on public.services for all to authenticated
using ((select public.is_establishment_admin(establishment_id)))
with check ((select public.is_establishment_admin(establishment_id)));

create policy "Professionals read services from own appointments"
on public.services for select to authenticated
using (
  exists (
    select 1
    from public.appointments a
    where a.establishment_id = services.establishment_id
      and a.service_id = services.id
      and (select public.is_linked_professional(a.establishment_id, a.professional_id))
  )
);

drop policy if exists "Members manage business hours" on public.business_hours;
drop policy if exists "Admins manage business hours" on public.business_hours;
drop policy if exists "Professionals read own business hours" on public.business_hours;

create policy "Admins manage business hours"
on public.business_hours for all to authenticated
using ((select public.is_establishment_admin(establishment_id)))
with check ((select public.is_establishment_admin(establishment_id)));

create policy "Professionals read own business hours"
on public.business_hours for select to authenticated
using ((select public.is_linked_professional(establishment_id, professional_id)));

commit;
