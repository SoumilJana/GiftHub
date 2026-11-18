-- Phase 3.6: couple and group Circles.
--
-- A couple Circle holds exactly two people, and each person can be in only one.
-- Its name is optional: without one, the app shows "You and Maya". Both partners
-- are equal: either can rename or delete it. Older Circles of two or fewer are
-- asked once whether they're a couple (kind_confirmed = false until answered).

create type public.circle_kind as enum ('couple', 'group');

alter table public.circles
  add column kind public.circle_kind not null default 'group',
  add column kind_confirmed boolean not null default false;

-- Circles that already have three or more people are groups; never ask them.
update public.circles c set kind_confirmed = true
where (select count(*) from public.circle_members m where m.circle_id = c.id) > 2;

-- A couple Circle may have no name (the app shows "You and Maya").
alter table public.circles alter column name drop not null;
alter table public.circles drop constraint circles_name_check;
alter table public.circles add constraint circles_name_check
  check (case when name is null then kind = 'couple' else char_length(name) between 1 and 60 end);

-- People can change a Circle's name and code expiry, nothing else, directly.
-- The kind changes only through set_circle_kind.
revoke update on public.circles from anon, authenticated;
grant update (name, invite_expires_at) on public.circles to authenticated;

-- In a couple Circle both partners are equal: either can rename or delete it.
drop policy "circles: owner or admin update" on public.circles;
create policy "circles: owner or admin update, or either partner" on public.circles
  for update to authenticated
  using (private.circle_role_of(id) in ('owner', 'admin') or (kind = 'couple' and private.is_circle_member(id)))
  with check (private.circle_role_of(id) in ('owner', 'admin') or (kind = 'couple' and private.is_circle_member(id)));
drop policy "circles: owner delete" on public.circles;
create policy "circles: owner delete, or either partner" on public.circles
  for delete to authenticated
  using (private.circle_role_of(id) = 'owner' or (kind = 'couple' and private.is_circle_member(id)));

-- True when the user is in a couple Circle other than p_except.
create or replace function private.in_couple(p_user_id uuid, p_except uuid default null)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members m join public.circles c on c.id = m.circle_id
    where m.user_id = p_user_id and c.kind = 'couple' and c.id is distinct from p_except
  );
$$;

-- Joining: the existing quotas, plus the couple rules.
create or replace function private.enforce_membership_quota()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kind public.circle_kind := (select kind from public.circles where id = new.circle_id);
begin
  if v_kind = 'couple' then
    if (select count(*) from public.circle_members where circle_id = new.circle_id) >= 2 then
      raise exception 'This couple Circle already has two people.' using errcode = 'P0001';
    end if;
    if private.in_couple(new.user_id, new.circle_id) then
      raise exception 'You’re already in a couple Circle. You can be in one at a time.' using errcode = 'P0001';
    end if;
  end if;
  if (select count(*) from public.circle_members where circle_id = new.circle_id) >= 20 then
    raise exception 'This Circle is full (20 members).' using errcode = 'P0001';
  end if;
  if (select count(*) from public.circle_members where user_id = new.user_id) >= 10 then
    raise exception 'You can be in up to 10 Circles. Leave one to join another.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- create_circle gains a kind. A couple Circle needs no name.
drop function public.create_circle(text);
create function public.create_circle(p_name text, p_kind public.circle_kind default 'group')
returns public.circles
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  result public.circles;
begin
  if uid is null then
    raise exception 'Sign in to create a Circle.' using errcode = '42501';
  end if;
  if p_kind = 'couple' and private.in_couple(uid) then
    raise exception 'You’re already in a couple Circle. You can be in one at a time.' using errcode = 'P0001';
  end if;
  if p_kind = 'group' and v_name is null then
    raise exception 'Give your Circle a name.' using errcode = 'P0001';
  end if;

  loop
    begin
      insert into public.circles (name, invite_code, created_by, kind, kind_confirmed)
      values (v_name, private.new_invite_code(), uid, p_kind, true)
      returning * into result;
      exit;
    exception when unique_violation then
      -- invite code collision: try another
    end;
  end loop;

  insert into public.circle_members (circle_id, user_id, role) values (result.id, uid, 'owner');
  return result;
end;
$$;

-- set_circle_kind: answer "Is this just the two of you?", or switch later.
-- Becoming a couple needs two people or fewer, neither already in another couple.
-- Becoming a group keeps the couple's name, or names it after them.
create or replace function public.set_circle_kind(p_circle_id uuid, p_kind public.circle_kind)
returns public.circles
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.circles;
  v_role public.circle_role := private.circle_role_of(p_circle_id);
begin
  select * into v from public.circles where id = p_circle_id;
  if v.id is null or v_role is null then
    raise exception 'You’re not in this Circle.' using errcode = '42501';
  end if;
  -- Groups are changed by their owner or an admin; either partner can change a couple.
  if v.kind = 'group' and v_role = 'member' then
    raise exception 'Only the Circle owner or an admin can change this.' using errcode = '42501';
  end if;

  if p_kind = 'couple' and v.kind = 'group' then
    if (select count(*) from public.circle_members where circle_id = p_circle_id) > 2 then
      raise exception 'A couple Circle is for two people. This one has more.' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.circle_members m
      where m.circle_id = p_circle_id and private.in_couple(m.user_id, p_circle_id)
    ) then
      raise exception 'One of you is already in a couple Circle. Each person can be in one.' using errcode = 'P0001';
    end if;
  end if;

  update public.circles set
    kind = p_kind,
    kind_confirmed = true,
    name = case
      when p_kind = 'group' and name is null then coalesce(
        left((select string_agg(split_part(p.display_name, ' ', 1), ' & ' order by m.joined_at)
              from public.circle_members m join public.profiles p on p.id = m.user_id
              where m.circle_id = p_circle_id and p.display_name <> ''), 60),
        'Our Circle')
      else name
    end
  where id = p_circle_id
  returning * into v;
  return v;
end;
$$;

revoke execute on function public.create_circle(text, public.circle_kind) from public, anon;
revoke execute on function public.set_circle_kind(uuid, public.circle_kind) from public, anon;
revoke execute on function private.in_couple(uuid, uuid) from public, anon;
grant execute on function public.create_circle(text, public.circle_kind) to authenticated;
grant execute on function public.set_circle_kind(uuid, public.circle_kind) to authenticated;
grant execute on function private.in_couple(uuid, uuid) to authenticated;
