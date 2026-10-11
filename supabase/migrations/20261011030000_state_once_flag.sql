-- Mark single expected payments (total_count = 1) so apps can show them as one-time.

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
               case when r.total_count is null then null else r.total_count - r.posted_count end as remaining,
               (r.total_count = 1) as once
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
