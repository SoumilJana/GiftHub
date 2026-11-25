-- Update notes ("what's new"): the highest note number this person has seen, on any device.
-- 0 = none yet. Welcome sets it to the latest note, so new people never get the notes.
-- Written by the person themselves through the existing "profiles: update self" policy.
alter table public.profiles
  add column news_seen smallint not null default 0 check (news_seen >= 0);
