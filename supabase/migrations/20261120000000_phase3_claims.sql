-- Phase 3: Secretly Bought.
--
-- Claims are read and written only through the functions below, never through
-- the table. That keeps two promises at the database level:
--   1. The surprise is sacred: an owner never receives claim data for their own
--      wishes until they mark one received.
--   2. Each Circle is its own room: givers learn only whether a wish is claimed
--      and whether the claim is theirs, never who else claimed it or from which
--      Circle.
--
-- Live updates use claim_signals, an insert-only table holding just a Circle id.
-- The claims table itself leaves the Realtime publication, because Realtime sends
-- DELETE events (an undo) to every subscriber without checking row security.

-- ---------------------------------------------------------------------------
-- No direct access to claims. The RLS policies stay as a second line of defence.
-- ---------------------------------------------------------------------------
revoke all on public.claims from anon, authenticated;
alter publication supabase_realtime drop table public.claims;

-- ---------------------------------------------------------------------------
-- claim_signals: "something was claimed or unclaimed in this Circle".
-- Givers in the Circle receive the insert and refetch; the wish's owner is
-- excluded by row security, so their device never hears about it.
-- No foreign keys and no deletes, so Realtime never sends a DELETE event.
-- ---------------------------------------------------------------------------
create table public.claim_signals (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null,
  owner_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.claim_signals enable row level security;
create policy "claim_signals: givers in the Circle" on public.claim_signals
  for select to authenticated
  using (owner_id <> (select auth.uid()) and private.is_circle_member(circle_id));

revoke all on public.claim_signals from anon, authenticated;
grant select on public.claim_signals to authenticated;
alter publication supabase_realtime add table public.claim_signals;

create or replace function private.signal_claim_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item uuid := case when tg_op = 'DELETE' then old.item_id else new.item_id end;
begin
  insert into public.claim_signals (circle_id, owner_id)
  select ic.circle_id, i.owner_id
  from public.item_circles ic
  join public.items i on i.id = ic.item_id
  where ic.item_id = v_item;
  return null;
end;
$$;

create trigger claims_signal after insert or update or delete on public.claims
  for each row execute function private.signal_claim_change();

-- ---------------------------------------------------------------------------
-- circle_claims: claims on other people's active wishes shared with one Circle.
-- Returns only the status and whether the claim is yours.
-- ---------------------------------------------------------------------------
create or replace function public.circle_claims(p_circle_id uuid)
returns table (item_id uuid, status public.claim_status, mine boolean)
language sql stable security definer
set search_path = ''
as $$
  select c.item_id, c.status, c.claimed_by = (select auth.uid())
  from public.claims c
  join public.items i on i.id = c.item_id
  join public.item_circles ic on ic.item_id = c.item_id and ic.circle_id = p_circle_id
  where private.is_circle_member(p_circle_id)
    and i.owner_id <> (select auth.uid())
    and i.status = 'active';
$$;

-- claim_item: reserve or mark bought. Changing your own claim is allowed;
-- someone else's claim is not. The owner gets the same answer whether or not
-- the wish is claimed.
create or replace function public.claim_item(p_item_id uuid, p_status public.claim_status)
returns public.claim_status
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_by uuid;
begin
  if uid is null then
    raise exception 'Sign in to claim gifts.' using errcode = '42501';
  end if;
  if not private.can_see_item_as_giver(p_item_id)
     or not exists (select 1 from public.items where id = p_item_id and status = 'active') then
    raise exception 'This wish isn’t available any more.' using errcode = 'P0002';
  end if;

  insert into public.claims (item_id, claimed_by, status)
  values (p_item_id, uid, p_status)
  on conflict (item_id) do update set status = excluded.status
    where public.claims.claimed_by = uid
  returning claimed_by into v_by;

  if v_by is null then
    raise exception 'Someone has already claimed this.' using errcode = 'P0001';
  end if;
  return p_status;
end;
$$;

-- unclaim_item: undo your own claim. Does nothing if the claim isn't yours.
create or replace function public.unclaim_item(p_item_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to change a claim.' using errcode = '42501';
  end if;
  delete from public.claims where item_id = p_item_id and claimed_by = (select auth.uid());
end;
$$;

-- mark_received: the owner moves a wish to Received, which reveals the giver.
-- Returns one row with the giver's name and claim status, or no rows if nobody
-- claimed it in GiftHub.
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
  return query
    select p.display_name, c.status
    from public.claims c
    left join public.profiles p on p.id = c.claimed_by
    where c.item_id = p_item_id;
end;
$$;

-- my_received: who gave each of your received wishes.
create or replace function public.my_received()
returns table (item_id uuid, giver_name text, claim_status public.claim_status)
language sql stable security definer
set search_path = ''
as $$
  select i.id, p.display_name, c.status
  from public.items i
  join public.claims c on c.item_id = i.id
  left join public.profiles p on p.id = c.claimed_by
  where i.owner_id = (select auth.uid()) and i.status = 'received';
$$;

revoke execute on function public.circle_claims(uuid) from public, anon;
revoke execute on function public.claim_item(uuid, public.claim_status) from public, anon;
revoke execute on function public.unclaim_item(uuid) from public, anon;
revoke execute on function public.mark_received(uuid) from public, anon;
revoke execute on function public.my_received() from public, anon;
revoke execute on function private.signal_claim_change() from public, anon, authenticated;
grant execute on function public.circle_claims(uuid) to authenticated;
grant execute on function public.claim_item(uuid, public.claim_status) to authenticated;
grant execute on function public.unclaim_item(uuid) to authenticated;
grant execute on function public.mark_received(uuid) to authenticated;
grant execute on function public.my_received() to authenticated;
