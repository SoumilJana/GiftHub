-- New profiles take the currency the app detected at sign-up (passed as
-- user metadata "currency"), instead of always starting on USD.
-- Users can still change profiles.currency later (RLS: "profiles: update self").

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  detected text := upper(coalesce(new.raw_user_meta_data ->> 'currency', ''));
begin
  insert into public.profiles (id, display_name, currency)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 60), ''),
    case when detected ~ '^[A-Z]{3}$' then detected else 'USD' end
  );
  return new;
end;
$$;
