-- Phase 9: the server side of accounts. Two tables with the same sync shape,
-- row-level security, explicit grants, the sync rules as a trigger, a
-- keep-alive ping, and self-service account deletion.
--
-- This project has automatic table exposure off, so nothing here is reachable
-- through the Data API until it is granted below. Every grant is revoked
-- first, so the local stack (which still has Supabase's default grants) ends
-- up with exactly the same privileges as production.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------- tables

create table public.tasks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 10,000, not the 500 a user can type: tasks imported from the old app keep
  -- their full text (review 5). The client enforces 500 for new titles.
  title text not null check (char_length(title) between 1 and 10000),
  completed boolean not null default false,
  due_date date,
  vital boolean not null default false,
  category_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- No unique name: two offline devices can both create "Work", and a unique
  -- index would make the second push fail. Phase 10 offers a merge instead.
  name text not null check (char_length(name) between 1 and 40),
  color text not null check (color in ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

-- Matches the Phase 10 pull's keyset order.
create index tasks_pull_idx on public.tasks (user_id, server_updated_at, id);
create index categories_pull_idx on public.categories (user_id, server_updated_at, id);

-- ---------------------------------------------------------------- privileges

alter table public.tasks enable row level security;
alter table public.categories enable row level security;

revoke all on public.tasks, public.categories from public, anon, authenticated;
-- No delete: deletes are tombstones, and rows disappear only through the
-- account's `on delete cascade`.
grant select, insert, update on public.tasks, public.categories to authenticated;

create policy "Own tasks: read" on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Own tasks: add" on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Own tasks: change" on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Own labels: read" on public.categories for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Own labels: add" on public.categories for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Own labels: change" on public.categories for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- sync rules

-- The conflict rules live here, inside the row lock, so two devices pushing at
-- once are serialized by Postgres and no client can bypass them. Shared by
-- both tables: they have the same id, user_id, updated_at, deleted_at and
-- server_updated_at columns.
create function private.sync_before_update() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tombstone timestamptz := coalesce(old.deleted_at, new.deleted_at);
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
    raise exception 'A row''s id and owner can''t change' using errcode = '42501';
  end if;

  if new.updated_at <= old.updated_at then
    -- Last write wins: an older (or equal) edit changes nothing...
    new := old;
  else
    -- ...and a fast clock can win by at most five minutes.
    new.updated_at := least(new.updated_at, now() + interval '5 minutes');
  end if;

  -- A tombstone is terminal, whichever edit won.
  new.deleted_at := tombstone;
  -- Server time always moves forward, so Phase 10 can pull by it.
  new.server_updated_at := now();
  return new;
end;
$$;

create function private.sync_before_insert() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := least(new.updated_at, now() + interval '5 minutes');
  new.server_updated_at := now();
  return new;
end;
$$;

create trigger tasks_sync_before_update before update on public.tasks
  for each row execute function private.sync_before_update();
create trigger tasks_sync_before_insert before insert on public.tasks
  for each row execute function private.sync_before_insert();
create trigger categories_sync_before_update before update on public.categories
  for each row execute function private.sync_before_update();
create trigger categories_sync_before_insert before insert on public.categories
  for each row execute function private.sync_before_insert();

-- Each Data API request is one transaction, so no write commits more than 8s
-- after its server_updated_at stamp. Phase 10's 60s pull overlap relies on it.
alter role authenticated set statement_timeout = '8s';

-- ---------------------------------------------------------------- functions

-- Keep-alive for the free plan's 7-day pause: a scheduled workflow calls this
-- with the publishable key. It touches no table.
create function public.ping() returns integer
language sql
stable
set search_path = ''
as $$ select 1 $$;

revoke execute on function public.ping() from public, anon, authenticated;
grant execute on function public.ping() to anon, authenticated;

-- Self-service account deletion, the "Delete account" button. Removing the
-- auth user cascades to every task and label it owns. Security definer
-- because only the database owner may delete from auth.users; it can only
-- ever delete the caller. The caller also names the account they confirmed:
-- if another tab has since signed in as someone else, the ids differ and
-- nothing is deleted (review 9).
create function public.delete_my_account(expected_user_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if expected_user_id is distinct from auth.uid() then
    raise exception 'This is no longer the account you confirmed' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_my_account(uuid) to authenticated;
