-- Security Advisor (19 Nov 2026): public.rls_auto_enable() was executable by anon and
-- authenticated through /rest/v1/rpc. It is Supabase's own event-trigger function (it
-- turns RLS on for new tables), created with the project, not by our migrations. An
-- event-trigger function can't be called directly, so this only removes the grant;
-- the event trigger keeps firing as before.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
