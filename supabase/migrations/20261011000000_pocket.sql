-- Pocket: a single-user money ledger.
-- Tables are locked (RLS on, no policies). The only way in is through the
-- pocket_* functions, which require the secret key. Only a SHA-256 hash of the key is stored.

create extension if not exists pgcrypto with schema extensions;

create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  amount      numeric(12,2) not null check (amount <> 0), -- negative = spent, positive = money in
  label       text not null check (length(label) between 1 and 120),
  occurred_on date not null default current_date,
  created_at  timestamptz not null default now()
);
create index transactions_order_idx on public.transactions (occurred_on desc, created_at desc);

create table public.app_secret (
  id       int primary key default 1 check (id = 1),
  key_hash text not null
);

alter table public.transactions enable row level security;
alter table public.app_secret   enable row level security;
revoke all on public.transactions, public.app_secret from anon, authenticated;

create function public.pocket_check(k text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if k is null or not exists (
    select 1 from app_secret where key_hash = encode(digest(k, 'sha256'), 'hex')
  ) then
    raise exception 'invalid key' using errcode = '28000';
  end if;
end $$;

create function public.pocket_list(k text) returns setof public.transactions
language plpgsql security definer set search_path = public as $$
begin
  perform pocket_check(k);
  return query select * from transactions order by occurred_on desc, created_at desc;
end $$;

create function public.pocket_balance(k text) returns numeric
language plpgsql security definer set search_path = public as $$
begin
  perform pocket_check(k);
  return coalesce((select sum(amount) from transactions), 0);
end $$;

create function public.pocket_add(k text, p_amount numeric, p_label text, p_on date default current_date)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare r transactions;
begin
  perform pocket_check(k);
  insert into transactions (amount, label, occurred_on)
  values (round(p_amount, 2), trim(p_label), coalesce(p_on, current_date))
  returning * into r;
  return r;
end $$;

create function public.pocket_update(k text, p_id uuid, p_amount numeric, p_label text, p_on date)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare r transactions;
begin
  perform pocket_check(k);
  update transactions
     set amount = round(p_amount, 2), label = trim(p_label), occurred_on = p_on
   where id = p_id
  returning * into r;
  return r;
end $$;

create function public.pocket_delete(k text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pocket_check(k);
  delete from transactions where id = p_id;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.pocket_list(text),
  public.pocket_balance(text),
  public.pocket_add(text, numeric, text, date),
  public.pocket_update(text, uuid, numeric, text, date),
  public.pocket_delete(text, uuid)
to anon;
