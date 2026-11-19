-- Pre-beta edge-case fixes (Phase 4.5), found by supabase/rls-tests/edge.test.mjs.
--
-- 1. A reservation is dropped when its giver can no longer see the wish: the owner
--    stopped sharing it with their Circle, or the giver left or was removed. Before,
--    the claim stayed and the wish was stuck as "claimed" for everyone else.
--    Bought claims are kept: the gift has already been paid for.
-- 2. save_item gives plain messages for a price that is negative or too big, a
--    currency that isn't a 3-letter code, and a photo that isn't a web address.
-- 3. items.image_url must be a web address (not valid: old rows aren't rechecked).

create or replace function private.drop_unseen_reservations()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'item_circles' then
    delete from public.claims c
    where c.item_id = old.item_id and c.status = 'reserved'
      and not exists (
        select 1 from public.item_circles ic
        join public.circle_members cm on cm.circle_id = ic.circle_id
        where ic.item_id = c.item_id and cm.user_id = c.claimed_by);
  else
    delete from public.claims c
    where c.claimed_by = old.user_id and c.status = 'reserved'
      and not exists (
        select 1 from public.item_circles ic
        join public.circle_members cm on cm.circle_id = ic.circle_id
        where ic.item_id = c.item_id and cm.user_id = c.claimed_by);
  end if;
  return old;
end;
$$;
revoke execute on function private.drop_unseen_reservations() from public, anon, authenticated;

create trigger item_circles_drop_unseen_reservations after delete on public.item_circles
  for each row execute function private.drop_unseen_reservations();
create trigger circle_members_drop_unseen_reservations after delete on public.circle_members
  for each row execute function private.drop_unseen_reservations();

alter table public.items add constraint items_image_url_check
  check (image_url ~* '^https?://') not valid;

create or replace function public.save_item(
  p_id uuid,
  p_title text,
  p_url text,
  p_image_url text,
  p_price numeric,
  p_currency text,
  p_priority smallint,
  p_notes text,
  p_occasions public.occasion[],
  p_circle_ids uuid[]
)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_item uuid;
  v_url text := nullif(trim(p_url), '');
  v_domain text := lower(substring(nullif(trim(p_url), '') from '^[hH][tT][tT][pP][sS]?://(?:www\.)?([^/:?#]+)'));
begin
  if uid is null then
    raise exception 'Sign in to save wishes.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Give your wish a name.' using errcode = 'P0001';
  end if;
  if p_price is not null and p_price < 0 then
    raise exception 'A price can’t be negative.' using errcode = '22023';
  end if;
  if p_price is not null and p_price >= 10000000000 then
    raise exception 'That price is too high.' using errcode = '22023';
  end if;
  if upper(trim(coalesce(p_currency, ''))) !~ '^[A-Z]{3}$' then
    raise exception 'Pick a currency code like INR or USD.' using errcode = '22023';
  end if;
  if nullif(trim(p_image_url), '') !~* '^https?://' then
    raise exception 'The photo has to be a web address.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.items (owner_id, title, url, image_url, domain, price, currency, priority, notes)
    values (uid, trim(p_title), v_url, nullif(trim(p_image_url), ''), v_domain, p_price, upper(trim(p_currency)),
            coalesce(p_priority, 5), nullif(trim(p_notes), ''))
    returning id into v_item;
  else
    update public.items
    set title = trim(p_title), url = v_url, image_url = nullif(trim(p_image_url), ''), domain = v_domain,
        price = p_price, currency = upper(trim(p_currency)), priority = coalesce(p_priority, 5), notes = nullif(trim(p_notes), '')
    where id = p_id and owner_id = uid
    returning id into v_item;
    if v_item is null then
      raise exception 'That wish no longer exists.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.item_occasions o
  where o.item_id = v_item and o.occasion <> all (coalesce(p_occasions, '{}'));
  insert into public.item_occasions (item_id, occasion)
  select v_item, x from unnest(coalesce(p_occasions, '{}')) as x
  on conflict do nothing;

  delete from public.item_circles ic
  where ic.item_id = v_item and ic.circle_id <> all (coalesce(p_circle_ids, '{}'));
  insert into public.item_circles (item_id, circle_id)
  select v_item, c from unnest(coalesce(p_circle_ids, '{}')) as c
  where private.is_circle_member(c)
  on conflict do nothing;

  return v_item;
end;
$$;
