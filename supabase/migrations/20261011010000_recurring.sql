-- Repeating money: subscriptions, bills, paychecks.
-- A rule posts a real transaction on each due date. Occurrence n falls on
-- anchor_on + n * cadence (counted from the anchor, so Jan 31 monthly -> Feb 28 -> Mar 31).

create table public.recurring (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric(12,2) not null check (amount <> 0), -- negative = bill/subscription, positive = income
  label        text not null check (length(label) between 1 and 120),
  cadence      text not null check (cadence in ('weekly', 'biweekly', 'monthly', 'yearly')),
  anchor_on    date not null,                -- first payment date
  posted_count int  not null default 0,      -- occurrences already turned into transactions
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.recurring enable row level security;
revoke all on public.recurring from anon, authenticated;

alter table public.transactions
  add column recurring_id uuid references public.recurring(id) on delete set null;

create function public.pocket_step(p_cadence text, n int) returns interval
language sql immutable as $$
  select case p_cadence
    when 'weekly'   then make_interval(days => 7 * n)
    when 'biweekly' then make_interval(days => 14 * n)
    when 'monthly'  then make_interval(months => n)
    when 'yearly'   then make_interval(years => n)
  end
$$;

-- Turn every due occurrence (on or before p_today) into a transaction.
-- FOR UPDATE makes concurrent callers wait, so nothing posts twice.
create function public.pocket_post_due(p_today date) returns void
language plpgsql security definer set search_path = public as $$
declare
  r recurring;
  d date;
  guard int;
begin
  for r in select * from recurring where active order by id for update loop
    guard := 0;
    loop
      d := (r.anchor_on + pocket_step(r.cadence, r.posted_count))::date;
      exit when d > p_today or guard >= 400;
      insert into transactions (amount, label, occurred_on, recurring_id)
      values (r.amount, r.label, d, r.id);
      r.posted_count := r.posted_count + 1;
      guard := guard + 1;
    end loop;
    if guard > 0 then
      update recurring set posted_count = r.posted_count where id = r.id;
    end if;
  end loop;
end $$;

-- Everything a client needs in one call.
create function public.pocket_state(k text, p_today date default current_date, p_days int default 30)
returns json
language plpgsql security definer set search_path = public as $$
begin
  perform pocket_check(k);
  perform pocket_post_due(p_today);
  return json_build_object(
    'transactions', coalesce((
      select json_agg(t order by t.occurred_on desc, t.created_at desc) from transactions t
    ), '[]'::json),
    'recurring', coalesce((
      select json_agg(x order by x.next_on, x.label) from (
        select r.id, r.amount, r.label, r.cadence, r.active,
               (r.anchor_on + pocket_step(r.cadence, r.posted_count))::date as next_on
        from recurring r
      ) x
    ), '[]'::json),
    'upcoming', coalesce((
      select json_agg(u order by u.due_on, u.label) from (
        select r.id as recurring_id, r.label, r.amount,
               (r.anchor_on + pocket_step(r.cadence, r.posted_count + g))::date as due_on
        from recurring r cross join generate_series(0, 60) g
        where r.active
          and (r.anchor_on + pocket_step(r.cadence, r.posted_count + g))::date <= p_today + p_days
      ) u
    ), '[]'::json)
  );
end $$;

create function public.pocket_recurring_add(
  k text, p_amount numeric, p_label text, p_cadence text, p_start date, p_today date default current_date
) returns json
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  perform pocket_check(k);
  insert into recurring (amount, label, cadence, anchor_on)
  values (round(p_amount, 2), trim(p_label), p_cadence, p_start)
  returning id into new_id;
  perform pocket_post_due(p_today);
  return json_build_object('id', new_id);
end $$;

-- Amount/label changes apply to future payments only. Moving the next date or
-- changing how often restarts the schedule from p_next.
create function public.pocket_recurring_update(
  k text, p_id uuid, p_amount numeric, p_label text, p_cadence text, p_next date,
  p_active boolean default true, p_today date default current_date
) returns void
language plpgsql security definer set search_path = public as $$
declare r recurring;
begin
  perform pocket_check(k);
  select * into r from recurring where id = p_id for update;
  if not found then return; end if;
  if p_cadence <> r.cadence or p_next <> (r.anchor_on + pocket_step(r.cadence, r.posted_count))::date then
    update recurring set anchor_on = p_next, posted_count = 0, cadence = p_cadence where id = p_id;
  end if;
  update recurring set amount = round(p_amount, 2), label = trim(p_label), active = p_active where id = p_id;
  perform pocket_post_due(p_today);
end $$;

-- Stops future payments. Ones already logged stay in history.
create function public.pocket_recurring_delete(k text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pocket_check(k);
  delete from recurring where id = p_id;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.pocket_list(text),
  public.pocket_balance(text),
  public.pocket_add(text, numeric, text, date),
  public.pocket_update(text, uuid, numeric, text, date),
  public.pocket_delete(text, uuid),
  public.pocket_state(text, date, int),
  public.pocket_recurring_add(text, numeric, text, text, date, date),
  public.pocket_recurring_update(text, uuid, numeric, text, text, date, boolean, date),
  public.pocket_recurring_delete(text, uuid)
to anon;
