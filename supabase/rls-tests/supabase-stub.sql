-- Minimal stand-ins for the parts of Supabase the migrations rely on (auth schema, roles, pgcrypto, realtime publication).
-- Lets RLS tests run in PGlite without Docker.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions; create extension pgcrypto schema extensions;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, extensions to authenticated, anon;
grant execute on all functions in schema auth, extensions to authenticated;
create publication supabase_realtime;
