-- GiftHub schema v1
-- Core privacy rule: a user never receives claim data for their own items
-- (until they mark the item received). Enforced here by RLS, never in the client.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.circle_role as enum ('owner', 'admin', 'member');
create type public.item_status as enum ('active', 'received', 'archived');
create type public.claim_status as enum ('reserved', 'bought');
create type public.occasion as enum ('anniversary', 'birthday', 'holiday', 'valentines_day', 'just_because');
create type public.parse_job_status as enum ('queued', 'running', 'done', 'failed');

-- Helper functions live in a schema that is not exposed through the API.
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text,
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now()
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique check (invite_code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  invite_expires_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index circles_created_by_idx on public.circles (created_by);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.circle_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index circle_members_user_id_idx on public.circle_members (user_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  url text check (url is null or url ~* '^https?://'),
  image_url text,
  domain text,
  price numeric(12, 2) check (price is null or price >= 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  original_price numeric(12, 2) check (original_price is null or original_price >= 0),
  priority smallint not null default 5 check (priority between 1 and 10),
  notes text check (notes is null or char_length(notes) <= 2000),
  status public.item_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_owner_id_idx on public.items (owner_id);
create index items_owner_active_idx on public.items (owner_id) where status = 'active';

create table public.item_circles (
  item_id uuid not null references public.items (id) on delete cascade,
  circle_id uuid not null references public.circles (id) on delete cascade,
  primary key (item_id, circle_id)
);
create index item_circles_circle_id_idx on public.item_circles (circle_id);

create table public.item_occasions (
  item_id uuid not null references public.items (id) on delete cascade,
  occasion public.occasion not null,
  primary key (item_id, occasion)
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.items (id) on delete cascade,
  claimed_by uuid not null references public.profiles (id) on delete cascade,
  status public.claim_status not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index claims_claimed_by_idx on public.claims (claimed_by);

create table public.price_history (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.items (id) on delete cascade,
  price numeric(12, 2) not null check (price >= 0),
  checked_at timestamptz not null default now()
);
create index price_history_item_checked_idx on public.price_history (item_id, checked_at desc);

-- Server-only tables (no RLS policies: only the service role can use them).
create table public.parse_cache (
  url_hash text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create table public.parse_jobs (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  item_id uuid references public.items (id) on delete cascade,
  status public.parse_job_status not null default 'queued',
  attempts smallint not null default 0,
  created_at timestamptz not null default now()
);
create index parse_jobs_item_id_idx on public.parse_jobs (item_id);
create index parse_jobs_queued_idx on public.parse_jobs (created_at) where status = 'queued';

create table public.join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index join_attempts_user_time_idx on public.join_attempts (user_id, attempted_at desc);

-- Owner-only tables.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

create table public.quick_add_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  label text check (label is null or char_length(label) <= 60),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index quick_add_tokens_user_id_idx on public.quick_add_tokens (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------
create or replace function private.is_circle_member(p_circle_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.circle_role_of(p_circle_id uuid)
returns public.circle_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.circle_members
  where circle_id = p_circle_id and user_id = (select auth.uid());
$$;

create or replace function private.shares_circle_with(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members mine
    join public.circle_members theirs on theirs.circle_id = mine.circle_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

-- True when the current user can see the item through any shared Circle.
-- Deliberately false for the item's owner: owners reach their items via owner_id.
create or replace function private.can_see_item_as_giver(p_item_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.items i
    join public.item_circles ic on ic.item_id = i.id
    join public.circle_members cm on cm.circle_id = ic.circle_id
    where i.id = p_item_id
      and i.owner_id <> (select auth.uid())
      and cm.user_id = (select auth.uid())
  );
$$;

create or replace function private.owns_item(p_item_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.items where id = p_item_id and owner_id = (select auth.uid())
  );
$$;

create or replace function private.item_is_received_by_me(p_item_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.items
    where id = p_item_id and owner_id = (select auth.uid()) and status = 'received'
  );
$$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: profile creation, updated_at, quotas
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 60), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_touch_updated_at before update on public.items
  for each row execute function private.touch_updated_at();
create trigger claims_touch_updated_at before update on public.claims
  for each row execute function private.touch_updated_at();

-- Free-tier quota: 150 active items per user.
create or replace function private.enforce_item_quota()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and (
    select count(*) from public.items where owner_id = new.owner_id and status = 'active' and id <> new.id
  ) >= 150 then
    raise exception 'You can have up to 150 active items. Archive or remove some to add more.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger items_quota before insert or update of status on public.items
  for each row execute function private.enforce_item_quota();

-- Free-tier quota: 20 members per Circle, 10 Circles per user.
create or replace function private.enforce_membership_quota()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.circle_members where circle_id = new.circle_id) >= 20 then
    raise exception 'This Circle is full (20 members).' using errcode = 'P0001';
  end if;
  if (select count(*) from public.circle_members where user_id = new.user_id) >= 10 then
    raise exception 'You can be in up to 10 Circles. Leave one to join another.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger circle_members_quota before insert on public.circle_members
  for each row execute function private.enforce_membership_quota();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.items enable row level security;
alter table public.item_circles enable row level security;
alter table public.item_occasions enable row level security;
alter table public.claims enable row level security;
alter table public.price_history enable row level security;
alter table public.parse_cache enable row level security;
alter table public.parse_jobs enable row level security;
alter table public.join_attempts enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.quick_add_tokens enable row level security;
alter table public.notifications enable row level security;

-- profiles: yourself and people you share a Circle with.
create policy "profiles: read self and circle-mates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_circle_with(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- circles: members read; owner/admin rename. Create/join only through RPCs.
create policy "circles: members read" on public.circles
  for select to authenticated
  using (private.is_circle_member(id));
create policy "circles: owner or admin update" on public.circles
  for update to authenticated
  using (private.circle_role_of(id) in ('owner', 'admin'))
  with check (private.circle_role_of(id) in ('owner', 'admin'));
create policy "circles: owner delete" on public.circles
  for delete to authenticated
  using (private.circle_role_of(id) = 'owner');

-- circle_members: visible to the same Circle; leave yourself, or owner/admin removes others.
create policy "circle_members: members read" on public.circle_members
  for select to authenticated
  using (private.is_circle_member(circle_id));
create policy "circle_members: leave or remove" on public.circle_members
  for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (private.circle_role_of(circle_id) = 'owner' and user_id <> (select auth.uid()))
    or (private.circle_role_of(circle_id) = 'admin' and role = 'member')
  );

-- items: owner has full access; givers read items shared to their Circles.
create policy "items: owner read" on public.items
  for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "items: givers read" on public.items
  for select to authenticated
  using (private.can_see_item_as_giver(id));
create policy "items: owner insert" on public.items
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "items: owner update" on public.items
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "items: owner delete" on public.items
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- item_circles: owner shares items only into Circles they belong to.
create policy "item_circles: owner or circle member read" on public.item_circles
  for select to authenticated
  using (private.owns_item(item_id) or private.is_circle_member(circle_id));
create policy "item_circles: owner insert" on public.item_circles
  for insert to authenticated
  with check (private.owns_item(item_id) and private.is_circle_member(circle_id));
create policy "item_circles: owner delete" on public.item_circles
  for delete to authenticated
  using (private.owns_item(item_id));

-- item_occasions: readable with the item; written by the owner.
create policy "item_occasions: read with item" on public.item_occasions
  for select to authenticated
  using (private.owns_item(item_id) or private.can_see_item_as_giver(item_id));
create policy "item_occasions: owner insert" on public.item_occasions
  for insert to authenticated
  with check (private.owns_item(item_id));
create policy "item_occasions: owner delete" on public.item_occasions
  for delete to authenticated
  using (private.owns_item(item_id));

-- claims: THE privacy rule.
-- Givers see claims on items they can see; owners never do, until they mark the item received.
create policy "claims: givers read" on public.claims
  for select to authenticated
  using (private.can_see_item_as_giver(item_id));
create policy "claims: owner reads after received" on public.claims
  for select to authenticated
  using (private.item_is_received_by_me(item_id));
create policy "claims: givers claim for themselves" on public.claims
  for insert to authenticated
  with check (claimed_by = (select auth.uid()) and private.can_see_item_as_giver(item_id));
create policy "claims: claimer updates" on public.claims
  for update to authenticated
  using (claimed_by = (select auth.uid()))
  with check (claimed_by = (select auth.uid()) and private.can_see_item_as_giver(item_id));
create policy "claims: claimer undoes" on public.claims
  for delete to authenticated
  using (claimed_by = (select auth.uid()));

-- price_history: readable with the item; written by the server only.
create policy "price_history: read with item" on public.price_history
  for select to authenticated
  using (private.owns_item(item_id) or private.can_see_item_as_giver(item_id));

-- Owner-only tables.
create policy "push_subscriptions: owner all" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "quick_add_tokens: owner read" on public.quick_add_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "quick_add_tokens: owner revoke" on public.quick_add_tokens
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: owner read" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: owner mark read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- parse_cache, parse_jobs, join_attempts: RLS on, no policies => service role only.

-- ---------------------------------------------------------------------------
-- RPCs: creating and joining Circles
-- ---------------------------------------------------------------------------
-- 31-character alphabet without 0/O, 1/I/L. 31^6 ~= 887M codes.
create or replace function private.new_invite_code()
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  code text := '';
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.create_circle(p_name text)
returns public.circles
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result public.circles;
begin
  if uid is null then
    raise exception 'Sign in to create a Circle.' using errcode = '42501';
  end if;

  loop
    begin
      insert into public.circles (name, invite_code, created_by)
      values (trim(p_name), private.new_invite_code(), uid)
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

create or replace function public.join_circle(p_code text)
returns public.circles
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target public.circles;
begin
  if uid is null then
    raise exception 'Sign in to join a Circle.' using errcode = '42501';
  end if;

  if (select count(*) from public.join_attempts
      where user_id = uid and attempted_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many tries. Wait an hour, then enter the code again.' using errcode = 'P0001';
  end if;
  insert into public.join_attempts (user_id) values (uid);

  select * into target from public.circles where invite_code = upper(trim(p_code));
  if target.id is null or (target.invite_expires_at is not null and target.invite_expires_at < now()) then
    -- Return null instead of raising: an exception would roll back the
    -- join_attempts row above and defeat the rate limit.
    -- Client shows: "That code doesn't match an open Circle. Check it with the person who sent it."
    return null;
  end if;

  insert into public.circle_members (circle_id, user_id) values (target.id, uid)
  on conflict do nothing;
  return target;
end;
$$;

create or replace function public.regenerate_invite_code(p_circle_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  code text;
begin
  if private.circle_role_of(p_circle_id) is distinct from 'owner'
     and private.circle_role_of(p_circle_id) is distinct from 'admin' then
    raise exception 'Only the Circle owner or an admin can change the invite code.' using errcode = '42501';
  end if;
  loop
    begin
      code := private.new_invite_code();
      update public.circles set invite_code = code where id = p_circle_id;
      return code;
    exception when unique_violation then
    end;
  end loop;
end;
$$;

revoke execute on function public.create_circle(text) from public, anon;
revoke execute on function public.join_circle(text) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.create_circle(text) to authenticated;
grant execute on function public.join_circle(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: claims and items stream to clients (RLS still applies).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.claims, public.items;
