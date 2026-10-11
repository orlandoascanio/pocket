-- v2: categories, quick-add presets, paired devices, payments that wait for confirmation,
-- pause / skip / "got it" on repeating money, and a keep-alive ping.

-- ---------- categories ----------
alter table public.transactions add column category text check (category is null or length(category) between 1 and 40);
alter table public.recurring    add column category text check (category is null or length(category) between 1 and 40);

-- auto = false: don't log it by itself on the due date; wait until I confirm it arrived
-- (freelance money that can come late, or not at all).
alter table public.recurring add column auto boolean not null default true;

-- ---------- quick-add buttons ----------
create table public.presets (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (length(label) between 1 and 120),
  amount     numeric(12,2) check (amount is null or amount > 0), -- null = ask for the amount each time
  sign       smallint not null default -1 check (sign in (-1, 1)),
  category   text check (category is null or length(category) between 1 and 40),
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- paired devices ----------
create table public.devices (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 60),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

-- At most one pairing code at a time; it expires and burns after 5 wrong tries.
create table public.pairing (
  id         int primary key default 1 check (id = 1),
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0
);

alter table public.presets enable row level security;
alter table public.devices enable row level security;
alter table public.pairing enable row level security;
revoke all on public.presets, public.devices, public.pairing from anon, authenticated;

-- ---------- access: the master key or any paired device's token ----------
create or replace function public.pocket_check(k text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if k is null or length(k) < 16 then
    raise exception 'invalid key' using errcode = '28000';
  end if;
  h := encode(digest(k, 'sha256'), 'hex');
  if exists (select 1 from app_secret where key_hash = h) then return; end if;
  if exists (select 1 from devices where token_hash = h) then
    update devices set last_seen = now() where token_hash = h and last_seen < now() - interval '5 minutes';
    return;
  end if;
  raise exception 'invalid key' using errcode = '28000';
end $$;

-- ---------- repeating money ----------
create or replace function public.pocket_post_due(p_today date) returns void
language plpgsql security definer set search_path = public as $$
declare
  r recurring;
  d date;
  guard int;
begin
  for r in select * from recurring where active and auto order by id for update loop
    guard := 0;
    loop
      exit when r.total_count is not null and r.posted_count >= r.total_count;
      d := (r.anchor_on + pocket_step(r.cadence, r.posted_count))::date;
      exit when d > p_today or guard >= 400;
      insert into transactions (amount, label, occurred_on, recurring_id, category)
      values (r.amount, r.label, d, r.id, r.category);
      r.posted_count := r.posted_count + 1;
      guard := guard + 1;
    end loop;
    if guard > 0 then
      update recurring set posted_count = r.posted_count where id = r.id;
    end if;
  end loop;
end $$;

create or replace function public.pocket_state(k text, p_today date default current_date, p_days int default 30)
returns json
language plpgsql security definer set search_path = public as $$
declare horizon date := p_today + least(greatest(p_days, 1), 400);
begin
  perform pocket_check(k);
  perform pocket_post_due(p_today);
  return json_build_object(
    'transactions', coalesce((
      select json_agg(t order by t.occurred_on desc, t.created_at desc) from transactions t
    ), '[]'::json),
    'recurring', coalesce((
      select json_agg(x order by x.active desc, x.next_on, x.label) from (
        select r.id, r.amount, r.label, r.cadence, r.active, r.auto, r.category,
               (r.anchor_on + pocket_step(r.cadence, r.posted_count))::date as next_on,
               case when r.total_count is null then null else r.total_count - r.posted_count end as remaining,
               (r.total_count = 1) as once
        from recurring r
        where r.total_count is null or r.posted_count < r.total_count
      ) x
    ), '[]'::json),
    -- overdue = due but not confirmed yet (only rules that wait for confirmation)
    'upcoming', coalesce((
      select json_agg(u order by u.due_on, u.label) from (
        select r.id as recurring_id, r.label, r.amount, r.category, r.auto,
               (r.anchor_on + pocket_step(r.cadence, r.posted_count + g))::date as due_on,
               (r.anchor_on + pocket_step(r.cadence, r.posted_count + g))::date <= p_today as overdue
        from recurring r cross join generate_series(0, 60) g
        where r.active
          and (r.total_count is null or r.posted_count + g < r.total_count)
          and (r.anchor_on + pocket_step(r.cadence, r.posted_count + g))::date <= horizon
      ) u
    ), '[]'::json),
    'presets', coalesce((
      select json_agg(p order by p.sort, p.created_at) from presets p
    ), '[]'::json)
  );
end $$;

-- Old signatures are replaced (overloads confuse the REST API). New params all have defaults,
-- so older clients keep working until they update.
drop function public.pocket_add(text, numeric, text, date);
drop function public.pocket_update(text, uuid, numeric, text, date);
drop function public.pocket_recurring_add(text, numeric, text, text, date, date, int);
drop function public.pocket_recurring_update(text, uuid, numeric, text, text, date, boolean, date, int);

-- p_category: null = no category on add / leave unchanged on update; '' = clear it.
create function public.pocket_add(
  k text, p_amount numeric, p_label text, p_on date default current_date, p_category text default null
) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare r transactions;
begin
  perform pocket_check(k);
  insert into transactions (amount, label, occurred_on, category)
  values (round(p_amount, 2), trim(p_label), coalesce(p_on, current_date), nullif(p_category, ''))
  returning * into r;
  return r;
end $$;

create function public.pocket_update(
  k text, p_id uuid, p_amount numeric, p_label text, p_on date, p_category text default null
) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare r transactions;
begin
  perform pocket_check(k);
  update transactions
     set amount = round(p_amount, 2), label = trim(p_label), occurred_on = p_on,
         category = case when p_category is null then category else nullif(p_category, '') end
   where id = p_id
  returning * into r;
  return r;
end $$;

create function public.pocket_recurring_add(
  k text, p_amount numeric, p_label text, p_cadence text, p_start date,
  p_today date default current_date, p_times int default null,
  p_category text default null, p_auto boolean default true
) returns json
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  perform pocket_check(k);
  insert into recurring (amount, label, cadence, anchor_on, total_count, category, auto)
  values (round(p_amount, 2), trim(p_label), p_cadence, p_start, p_times, nullif(p_category, ''), coalesce(p_auto, true))
  returning id into new_id;
  perform pocket_post_due(p_today);
  return json_build_object('id', new_id);
end $$;

-- p_left: payments still to come, counting the next one (null = keeps going).
-- Moving the next date or changing how often restarts the schedule from p_next.
create function public.pocket_recurring_update(
  k text, p_id uuid, p_amount numeric, p_label text, p_cadence text, p_next date,
  p_active boolean default null, p_today date default current_date, p_left int default null,
  p_category text default null, p_auto boolean default null
) returns void
language plpgsql security definer set search_path = public as $$
declare r recurring;
begin
  perform pocket_check(k);
  select * into r from recurring where id = p_id for update;
  if not found then return; end if;
  if p_cadence <> r.cadence or p_next <> (r.anchor_on + pocket_step(r.cadence, r.posted_count))::date then
    update recurring set anchor_on = p_next, posted_count = 0, cadence = p_cadence, total_count = p_left
     where id = p_id;
  else
    update recurring set total_count = case when p_left is null then null else posted_count + p_left end
     where id = p_id;
  end if;
  update recurring
     set amount = round(p_amount, 2), label = trim(p_label),
         active = coalesce(p_active, active), auto = coalesce(p_auto, auto),
         category = case when p_category is null then category else nullif(p_category, '') end
   where id = p_id;
  perform pocket_post_due(p_today);
end $$;

-- "Got it": log the next payment now, with the real amount and date (early, late, or different).
create function public.pocket_recurring_settle(
  k text, p_id uuid, p_amount numeric default null, p_on date default current_date, p_today date default current_date
) returns void
language plpgsql security definer set search_path = public as $$
declare r recurring;
begin
  perform pocket_check(k);
  select * into r from recurring where id = p_id for update;
  if not found or (r.total_count is not null and r.posted_count >= r.total_count) then return; end if;
  insert into transactions (amount, label, occurred_on, recurring_id, category)
  values (round(coalesce(p_amount, r.amount), 2), r.label, coalesce(p_on, p_today), r.id, r.category);
  update recurring set posted_count = posted_count + 1 where id = p_id;
  perform pocket_post_due(p_today);
end $$;

-- "Skip this one": the next payment won't happen.
create function public.pocket_recurring_skip(k text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pocket_check(k);
  update recurring set posted_count = posted_count + 1
   where id = p_id and (total_count is null or posted_count < total_count);
end $$;

-- Pause / resume. Resuming doesn't back-log what was missed while paused.
create function public.pocket_recurring_set_active(
  k text, p_id uuid, p_active boolean, p_today date default current_date
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r recurring;
  guard int := 0;
begin
  perform pocket_check(k);
  select * into r from recurring where id = p_id for update;
  if not found then return; end if;
  if p_active and not r.active then
    loop
      exit when (r.total_count is not null and r.posted_count >= r.total_count)
             or (r.anchor_on + pocket_step(r.cadence, r.posted_count))::date >= p_today
             or guard >= 400;
      r.posted_count := r.posted_count + 1;
      guard := guard + 1;
    end loop;
  end if;
  update recurring set active = p_active, posted_count = r.posted_count where id = p_id;
  perform pocket_post_due(p_today);
end $$;

-- ---------- quick-add buttons ----------
create function public.pocket_preset_save(
  k text, p_label text, p_sign int, p_amount numeric default null, p_category text default null, p_id uuid default null
) returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  perform pocket_check(k);
  if p_id is null then
    insert into presets (label, amount, sign, category, sort)
    values (trim(p_label), round(abs(nullif(p_amount, 0)), 2), case when p_sign > 0 then 1 else -1 end,
            nullif(p_category, ''), coalesce((select max(sort) + 1 from presets), 0))
    returning id into pid;
  else
    update presets
       set label = trim(p_label), amount = round(abs(nullif(p_amount, 0)), 2),
           sign = case when p_sign > 0 then 1 else -1 end, category = nullif(p_category, '')
     where id = p_id
    returning id into pid;
  end if;
  return json_build_object('id', pid);
end $$;

create function public.pocket_preset_delete(k text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pocket_check(k);
  delete from presets where id = p_id;
end $$;

-- ---------- pairing a new device ----------
-- A device that already has access asks for a 6-digit code; the new device redeems it
-- for its own token. Only hashes are stored.
create function public.pocket_pair_start(k text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  b bytea := gen_random_bytes(3);
  code text;
  expires timestamptz := now() + interval '10 minutes';
begin
  perform pocket_check(k);
  code := lpad((((get_byte(b, 0) << 16) | (get_byte(b, 1) << 8) | get_byte(b, 2)) % 1000000)::text, 6, '0');
  insert into pairing (id, code_hash, expires_at, attempts)
  values (1, encode(digest(code, 'sha256'), 'hex'), expires, 0)
  on conflict (id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0;
  return json_build_object('code', code, 'expires_at', expires);
end $$;

-- Never raises on a wrong code, so the attempt counter isn't rolled back.
create function public.pocket_pair_finish(p_code text, p_name text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  p pairing;
  tok text;
begin
  select * into p from pairing where id = 1 for update;
  if not found or p.expires_at < now() then
    delete from pairing where id = 1;
    return json_build_object('error', 'expired');
  end if;
  if p.code_hash <> encode(digest(regexp_replace(coalesce(p_code, ''), '\D', '', 'g'), 'sha256'), 'hex') then
    if p.attempts + 1 >= 5 then
      delete from pairing where id = 1;
      return json_build_object('error', 'too_many');
    end if;
    update pairing set attempts = attempts + 1 where id = 1;
    return json_build_object('error', 'wrong');
  end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into devices (name, token_hash)
  values (left(coalesce(nullif(trim(p_name), ''), 'Device'), 60), encode(digest(tok, 'sha256'), 'hex'));
  delete from pairing where id = 1;
  return json_build_object('token', tok);
end $$;

create function public.pocket_devices(k text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  perform pocket_check(k);
  h := encode(digest(k, 'sha256'), 'hex');
  return json_build_object(
    'master', exists (select 1 from app_secret where key_hash = h),
    'devices', coalesce((
      select json_agg(json_build_object('id', d.id, 'name', d.name, 'created_at', d.created_at,
                                        'last_seen', d.last_seen, 'this', d.token_hash = h)
                      order by d.last_seen desc)
      from devices d
    ), '[]'::json)
  );
end $$;

create function public.pocket_device_remove(k text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pocket_check(k);
  delete from devices where id = p_id;
end $$;

-- Keep-alive for the free plan (a daily request keeps the project from pausing). Reveals nothing.
create function public.pocket_ping() returns boolean
language sql security definer set search_path = public as $$ select exists (select 1 from app_secret) $$;

-- ---------- grants ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.pocket_list(text),
  public.pocket_balance(text),
  public.pocket_delete(text, uuid),
  public.pocket_recurring_delete(text, uuid),
  public.pocket_state(text, date, int),
  public.pocket_add(text, numeric, text, date, text),
  public.pocket_update(text, uuid, numeric, text, date, text),
  public.pocket_recurring_add(text, numeric, text, text, date, date, int, text, boolean),
  public.pocket_recurring_update(text, uuid, numeric, text, text, date, boolean, date, int, text, boolean),
  public.pocket_recurring_settle(text, uuid, numeric, date, date),
  public.pocket_recurring_skip(text, uuid),
  public.pocket_recurring_set_active(text, uuid, boolean, date),
  public.pocket_preset_save(text, text, int, numeric, text, uuid),
  public.pocket_preset_delete(text, uuid),
  public.pocket_pair_start(text),
  public.pocket_pair_finish(text, text),
  public.pocket_devices(text),
  public.pocket_device_remove(text, uuid),
  public.pocket_ping()
to anon;
