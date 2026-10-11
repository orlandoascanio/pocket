-- Repeating money that ends ("$750 monthly, 3 payments") and one-time money
-- expected on a future date (a rule with total_count = 1).

alter table public.recurring
  add column total_count int check (total_count is null or total_count >= 1); -- null = no end

create or replace function public.pocket_post_due(p_today date) returns void
language plpgsql security definer set search_path = public as $$
declare
  r recurring;
  d date;
  guard int;
begin
  for r in select * from recurring where active order by id for update loop
    guard := 0;
    loop
      exit when r.total_count is not null and r.posted_count >= r.total_count;
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

create or replace function public.pocket_state(k text, p_today date default current_date, p_days int default 30)
returns json
language plpgsql security definer set search_path = public as $$
begin
  perform pocket_check(k);
  perform pocket_post_due(p_today);
  return json_build_object(
    'transactions', coalesce((
      select json_agg(t order by t.occurred_on desc, t.created_at desc) from transactions t
    ), '[]'::json),
    -- finished rules (all payments made) drop out of the list
    'recurring', coalesce((
      select json_agg(x order by x.next_on, x.label) from (
        select r.id, r.amount, r.label, r.cadence, r.active,
               (r.anchor_on + pocket_step(r.cadence, r.posted_count))::date as next_on,
               case when r.total_count is null then null else r.total_count - r.posted_count end as remaining
        from recurring r
        where r.total_count is null or r.posted_count < r.total_count
      ) x
    ), '[]'::json),
    'upcoming', coalesce((
      select json_agg(u order by u.due_on, u.label) from (
        select r.id as recurring_id, r.label, r.amount,
               (r.anchor_on + pocket_step(r.cadence, r.posted_count + g))::date as due_on
        from recurring r cross join generate_series(0, 60) g
        where r.active
          and (r.total_count is null or r.posted_count + g < r.total_count)
          and (r.anchor_on + pocket_step(r.cadence, r.posted_count + g))::date <= p_today + p_days
      ) u
    ), '[]'::json)
  );
end $$;

-- Signatures change, so replace instead of overloading (overloads confuse the REST API).
drop function public.pocket_recurring_add(text, numeric, text, text, date, date);
drop function public.pocket_recurring_update(text, uuid, numeric, text, text, date, boolean, date);

-- p_times: how many payments in total (null = keeps going).
create function public.pocket_recurring_add(
  k text, p_amount numeric, p_label text, p_cadence text, p_start date,
  p_today date default current_date, p_times int default null
) returns json
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  perform pocket_check(k);
  insert into recurring (amount, label, cadence, anchor_on, total_count)
  values (round(p_amount, 2), trim(p_label), p_cadence, p_start, p_times)
  returning id into new_id;
  perform pocket_post_due(p_today);
  return json_build_object('id', new_id);
end $$;

-- p_left: payments still to come, counting the next one (null = keeps going).
-- Moving the next date or changing how often restarts the schedule from p_next.
create function public.pocket_recurring_update(
  k text, p_id uuid, p_amount numeric, p_label text, p_cadence text, p_next date,
  p_active boolean default true, p_today date default current_date, p_left int default null
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
  update recurring set amount = round(p_amount, 2), label = trim(p_label), active = p_active where id = p_id;
  perform pocket_post_due(p_today);
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.pocket_list(text),
  public.pocket_balance(text),
  public.pocket_add(text, numeric, text, date),
  public.pocket_update(text, uuid, numeric, text, date),
  public.pocket_delete(text, uuid),
  public.pocket_state(text, date, int),
  public.pocket_recurring_add(text, numeric, text, text, date, date, int),
  public.pocket_recurring_update(text, uuid, numeric, text, text, date, boolean, date, int),
  public.pocket_recurring_delete(text, uuid)
to anon;
