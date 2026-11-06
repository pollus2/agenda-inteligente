begin;

create or replace function public.link_professional_user(
  target_establishment_id uuid,
  target_professional_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  professional_email text;
  current_professional_user_id uuid;
  target_user_id uuid;
  current_membership_role text;
begin
  if not (select public.is_establishment_admin(target_establishment_id)) then
    raise exception 'Only establishment owners and managers can link professional accounts';
  end if;

  select p.email, p.user_id
    into professional_email, current_professional_user_id
  from public.professionals p
  where p.id = target_professional_id
    and p.establishment_id = target_establishment_id
  for update;

  if not found then
    raise exception 'Professional profile not found';
  end if;

  if professional_email is null or btrim(professional_email) = '' then
    raise exception 'Add the professional account email to the profile first';
  end if;

  select u.id
    into target_user_id
  from auth.users u
  where lower(u.email) = lower(btrim(professional_email))
    and u.email_confirmed_at is not null
  limit 1;

  if target_user_id is null then
    raise exception 'No confirmed Auth account found for the professional email';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_establishment_id::text || ':' || target_user_id::text, 0)
  );

  if current_professional_user_id is not null
    and current_professional_user_id <> target_user_id then
    raise exception 'This professional profile is already linked to another account';
  end if;

  if exists (
    select 1
    from public.professionals p
    where p.establishment_id = target_establishment_id
      and p.user_id = target_user_id
      and p.id <> target_professional_id
  ) then
    raise exception 'This account is already linked to another professional profile';
  end if;

  select m.role
    into current_membership_role
  from public.establishment_members m
  where m.establishment_id = target_establishment_id
    and m.user_id = target_user_id;

  if found and current_membership_role <> 'professional' then
    raise exception 'This account already has another role in the establishment';
  end if;

  if not found then
    insert into public.establishment_members (establishment_id, user_id, role)
    values (target_establishment_id, target_user_id, 'professional');
  end if;

  update public.professionals
  set user_id = target_user_id,
      updated_at = now()
  where id = target_professional_id
    and establishment_id = target_establishment_id;
end;
$function$;

revoke all on function public.link_professional_user(uuid, uuid) from public, anon;
grant execute on function public.link_professional_user(uuid, uuid) to authenticated;

commit;
