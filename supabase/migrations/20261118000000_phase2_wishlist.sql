-- Phase 2: wishlist core.
-- save_item / share_my_items RPCs, unsharing on leave, and the item-photos bucket.

-- ---------------------------------------------------------------------------
-- Leaving or being removed from a Circle unshares your items from it.
-- Without this, the people still in that Circle would keep seeing them.
-- ---------------------------------------------------------------------------
create or replace function private.unshare_on_leave()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.item_circles ic
  using public.items i
  where ic.item_id = i.id and ic.circle_id = old.circle_id and i.owner_id = old.user_id;
  return old;
end;
$$;

create trigger circle_members_unshare_on_leave after delete on public.circle_members
  for each row execute function private.unshare_on_leave();

-- ---------------------------------------------------------------------------
-- save_item: create or update a wish with its occasions and Circles in one
-- transaction. Runs as the caller, so every RLS policy still applies.
-- Circles the caller is not in are skipped.
-- ---------------------------------------------------------------------------
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

  if p_id is null then
    insert into public.items (owner_id, title, url, image_url, domain, price, currency, priority, notes)
    values (uid, trim(p_title), v_url, nullif(trim(p_image_url), ''), v_domain, p_price, upper(p_currency),
            coalesce(p_priority, 5), nullif(trim(p_notes), ''))
    returning id into v_item;
  else
    update public.items
    set title = trim(p_title), url = v_url, image_url = nullif(trim(p_image_url), ''), domain = v_domain,
        price = p_price, currency = upper(p_currency), priority = coalesce(p_priority, 5), notes = nullif(trim(p_notes), '')
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

-- share_my_items: shares all of the caller's active wishes with one Circle
-- (offered after joining a new Circle). Returns how many were newly shared.
create or replace function public.share_my_items(p_circle_id uuid)
returns integer
language plpgsql security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if not private.is_circle_member(p_circle_id) then
    raise exception 'You’re not in this Circle.' using errcode = '42501';
  end if;
  insert into public.item_circles (item_id, circle_id)
  select i.id, p_circle_id from public.items i
  where i.owner_id = (select auth.uid()) and i.status = 'active'
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.save_item(uuid, text, text, text, numeric, text, smallint, text, public.occasion[], uuid[]) from public, anon;
revoke execute on function public.share_my_items(uuid) from public, anon;
grant execute on function public.save_item(uuid, text, text, text, numeric, text, smallint, text, public.occasion[], uuid[]) to authenticated;
grant execute on function public.share_my_items(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Photos: public bucket, files under <user id>/, up to 10 per user, 200 KB each.
-- The app resizes to WebP of 100 KB or less before uploading.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', true, 204800, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create or replace function private.photo_count(p_user_id uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int from storage.objects
  where bucket_id = 'item-photos' and (storage.foldername(name))[1] = p_user_id::text;
$$;

revoke execute on function private.photo_count(uuid) from public, anon;
grant execute on function private.photo_count(uuid) to authenticated;
grant execute on function private.unshare_on_leave() to authenticated;

create policy "item-photos: owner uploads, up to 10" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.photo_count((select auth.uid())) < 10
  );
create policy "item-photos: owner reads own" on storage.objects
  for select to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "item-photos: owner deletes own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
