-- Quarterly repeating money: every 3 months, counted from the anchor like the others
-- (Nov 30 -> Feb 28 -> May 30), so month ends don't drift.

alter table public.recurring drop constraint recurring_cadence_check;
alter table public.recurring add constraint recurring_cadence_check
  check (cadence in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'));

create or replace function public.pocket_step(p_cadence text, n int) returns interval
language sql immutable as $$
  select case p_cadence
    when 'weekly'    then make_interval(days => 7 * n)
    when 'biweekly'  then make_interval(days => 14 * n)
    when 'monthly'   then make_interval(months => n)
    when 'quarterly' then make_interval(months => 3 * n)
    when 'yearly'    then make_interval(years => n)
  end
$$;
