-- Phase 3.5: gift hand-off.
-- The giver picks a date to give a bought gift; from the day after, they are
-- asked whether they gave it. Their "yes" asks the receiver whether they got it,
-- and the receiver's "yes" is Mark received.
--
-- Privacy: the give date lives on the claim and is returned only to the claimer.
-- The receiver gets nothing until the giver says the gift was handed over.

alter table public.claims
  add column give_on date,
  add column given_at timestamptz;

-- circle_claims gains the give date, returned only for your own claims.
drop function public.circle_claims(uuid);
create function public.circle_claims(p_circle_id uuid)
returns table (item_id uuid, status public.claim_status, mine boolean, give_on date)
language sql stable security definer
set search_path = ''
as $$
  select c.item_id, c.status, c.claimed_by = (select auth.uid()),
         case when c.claimed_by = (select auth.uid()) then c.give_on end
  from public.claims c
  join public.items i on i.id = c.item_id
  join public.item_circles ic on ic.item_id = c.item_id and ic.circle_id = p_circle_id
  where private.is_circle_member(p_circle_id)
    and i.owner_id <> (select auth.uid())
    and i.status = 'active';
$$;

-- Undoing a claim and claiming again starts the hand-off afresh.
create or replace function private.reset_handoff()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.claimed_by is distinct from old.claimed_by or (new.status = 'reserved' and old.status = 'bought') then
    new.give_on := null;
    new.given_at := null;
  end if;
  return new;
end;
$$;

create trigger claims_reset_handoff before update on public.claims
  for each row execute function private.reset_handoff();

-- set_give_date: the claimer picks (or clears) the day they'll give it.
create or replace function public.set_give_date(p_item_id uuid, p_give_on date)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.claims set give_on = p_give_on
  where item_id = p_item_id and claimed_by = (select auth.uid()) and given_at is null;
  if not found then
    raise exception 'That claim isn’t yours any more.' using errcode = 'P0002';
  end if;
end;
$$;

-- my_due_gifts: your bought gifts whose give date has passed and that you
-- haven't confirmed giving. p_today is the device's date, so "the day after"
-- follows the giver's own time zone (clamped to a day either side of UTC).
create or replace function public.my_due_gifts(p_today date)
returns table (item_id uuid, title text, owner_name text, give_on date)
language sql stable security definer
set search_path = ''
as $$
  select i.id, i.title, p.display_name, c.give_on
  from public.claims c
  join public.items i on i.id = c.item_id
  left join public.profiles p on p.id = i.owner_id
  where c.claimed_by = (select auth.uid())
    and c.status = 'bought'
    and c.given_at is null
    and c.give_on is not null
    and c.give_on < greatest(least(p_today, current_date + 1), current_date - 1)
    and i.status = 'active'
  order by c.give_on;
$$;

-- mark_given: the giver confirms the hand-off; the receiver is asked if they got it.
create or replace function public.mark_given(p_item_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_owner uuid;
begin
  update public.claims c set given_at = now(), status = 'bought'
  from public.items i
  where c.item_id = p_item_id and i.id = c.item_id
    and c.claimed_by = uid and c.given_at is null and i.status = 'active'
  returning i.owner_id into v_owner;
  if v_owner is null then
    raise exception 'That claim isn’t yours any more.' using errcode = 'P0002';
  end if;

  insert into public.notifications (user_id, type, payload)
  values (v_owner, 'gift_given', jsonb_build_object('item_id', p_item_id));
end;
$$;

-- received_prompts: "Did you get it?" questions for your still-active wishes.
create or replace function public.received_prompts()
returns table (id uuid, item_id uuid, title text, giver_name text)
language sql stable security definer
set search_path = ''
as $$
  select n.id, i.id, i.title, p.display_name
  from public.notifications n
  join public.items i on i.id = (n.payload ->> 'item_id')::uuid
  join public.claims c on c.item_id = i.id and c.given_at is not null
  left join public.profiles p on p.id = c.claimed_by
  where n.user_id = (select auth.uid())
    and n.type = 'gift_given'
    and n.read_at is null
    and i.owner_id = (select auth.uid())
    and i.status = 'active'
  order by n.created_at;
$$;

-- dismiss_prompt: "Not yet" on a received prompt.
create or replace function public.dismiss_prompt(p_id uuid)
returns void
language sql security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where id = p_id and user_id = (select auth.uid());
$$;

-- mark_received now also clears its pending prompt.
create or replace function public.mark_received(p_item_id uuid)
returns table (giver_name text, claim_status public.claim_status)
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.items set status = 'received'
  where id = p_item_id and owner_id = (select auth.uid()) and status = 'active';
  if not found then
    raise exception 'That wish isn’t on your list any more.' using errcode = 'P0002';
  end if;
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and type = 'gift_given' and read_at is null
    and payload ->> 'item_id' = p_item_id::text;
  return query
    select p.display_name, c.status
    from public.claims c
    left join public.profiles p on p.id = c.claimed_by
    where c.item_id = p_item_id;
end;
$$;

revoke execute on function public.circle_claims(uuid) from public, anon;
revoke execute on function public.set_give_date(uuid, date) from public, anon;
revoke execute on function public.my_due_gifts(date) from public, anon;
revoke execute on function public.mark_given(uuid) from public, anon;
revoke execute on function public.received_prompts() from public, anon;
revoke execute on function public.dismiss_prompt(uuid) from public, anon;
revoke execute on function private.reset_handoff() from public, anon, authenticated;
grant execute on function public.circle_claims(uuid) to authenticated;
grant execute on function public.set_give_date(uuid, date) to authenticated;
grant execute on function public.my_due_gifts(date) to authenticated;
grant execute on function public.mark_given(uuid) to authenticated;
grant execute on function public.received_prompts() to authenticated;
grant execute on function public.dismiss_prompt(uuid) to authenticated;
