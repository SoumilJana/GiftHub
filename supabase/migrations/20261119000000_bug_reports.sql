-- Phase 2.5: bug reports.
-- Reports are written only by the `report-bug` Edge Function (service role), which
-- verifies the sender, applies the daily limit and emails the owner. Users can never
-- read reports, including their own, so there are no RLS policies.

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  what_happened text not null check (char_length(what_happened) between 1 and 4000),
  expected text check (expected is null or char_length(expected) <= 2000),
  page text check (page is null or char_length(page) <= 500),
  app_version text check (app_version is null or char_length(app_version) <= 60),
  device text check (device is null or char_length(device) <= 500),
  screenshot_path text,
  emailed boolean not null default false,
  created_at timestamptz not null default now()
);

create index bug_reports_user_time_idx on public.bug_reports (user_id, created_at desc);
create index bug_reports_created_at_idx on public.bug_reports (created_at);

alter table public.bug_reports enable row level security;
-- No policies: service role only.

-- Private bucket for screenshots, written and read only by the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bug-screenshots', 'bug-screenshots', false, 400000, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;
