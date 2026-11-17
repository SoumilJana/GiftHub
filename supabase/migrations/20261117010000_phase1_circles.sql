-- Phase 1: Circle management and account deletion.
--
-- Cross-Circle privacy (PRODUCT.md principle 6) is already enforced by the v1
-- policies: circles, circle_members and item_circles rows are only readable by
-- members of that same Circle, and profiles only by people who share a Circle.
-- The RLS test suite checks it.

-- Deleting an account must not delete Circles other people still use.
alter table public.circles alter column created_by drop not null;
alter table public.circles drop constraint circles_created_by_fkey;
alter table public.circles
  add constraint circles_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- Hand a Circle to another member. The old owner becomes an admin.
create or replace function public.transfer_ownership(p_circle_id uuid, p_new_owner uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if private.circle_role_of(p_circle_id) is distinct from 'owner' then
    raise exception 'Only the Circle owner can hand it over.' using errcode = '42501';
  end if;
  if p_new_owner = uid or not exists (
    select 1 from public.circle_members where circle_id = p_circle_id and user_id = p_new_owner
  ) then
    raise exception 'Choose another member of this Circle.' using errcode = 'P0001';
  end if;
  update public.circle_members set role = 'owner' where circle_id = p_circle_id and user_id = p_new_owner;
  update public.circle_members set role = 'admin' where circle_id = p_circle_id and user_id = uid;
end;
$$;

-- Owner makes a member an admin, or an admin a member.
create or replace function public.set_member_role(p_circle_id uuid, p_user_id uuid, p_role public.circle_role)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if private.circle_role_of(p_circle_id) is distinct from 'owner' then
    raise exception 'Only the Circle owner can change roles.' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Use transfer_ownership to change the owner.' using errcode = 'P0001';
  end if;
  update public.circle_members set role = p_role
  where circle_id = p_circle_id and user_id = p_user_id and role <> 'owner';
  if not found then
    raise exception 'Choose another member of this Circle.' using errcode = 'P0001';
  end if;
end;
$$;

-- Delete the signed-in user's account and everything they own.
-- Circles they own pass to the longest-standing admin, else member; empty ones are deleted.
create or replace function public.delete_account()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  owned record;
  heir uuid;
begin
  if uid is null then
    raise exception 'Sign in to delete your account.' using errcode = '42501';
  end if;

  for owned in select circle_id from public.circle_members where user_id = uid and role = 'owner' loop
    select user_id into heir
    from public.circle_members
    where circle_id = owned.circle_id and user_id <> uid
    order by (role = 'admin') desc, joined_at
    limit 1;

    if heir is null then
      delete from public.circles where id = owned.circle_id;
    else
      update public.circle_members set role = 'owner' where circle_id = owned.circle_id and user_id = heir;
    end if;
  end loop;

  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.transfer_ownership(uuid, uuid) from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, public.circle_role) from public, anon;
revoke execute on function public.delete_account() from public, anon;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.circle_role) to authenticated;
grant execute on function public.delete_account() to authenticated;
