-- Self-hosting: a brand-new database has no key yet. The first app to call pocket_setup claims it
-- with a key it generated, and becomes the main device. After that it refuses, so it can't take over a
-- database that's already in use. Run every migration, then set up from Pocket for Mac right away.
create function public.pocket_setup(p_key text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_key is null or length(p_key) < 32 then
    return json_build_object('error', 'weak_key');
  end if;
  lock table app_secret in exclusive mode;
  if exists (select 1 from app_secret) or exists (select 1 from devices) then
    return json_build_object('error', 'already_set_up');
  end if;
  insert into app_secret (id, key_hash) values (1, encode(digest(p_key, 'sha256'), 'hex'));
  return json_build_object('ok', true);
end $$;

revoke execute on function public.pocket_setup(text) from public, authenticated;
grant execute on function public.pocket_setup(text) to anon;
