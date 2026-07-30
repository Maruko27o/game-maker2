create schema if not exists auth;
create table auth.users (id uuid primary key, email text, created_at timestamptz default now());
create table public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  rev bigint not null default 1,
  save_version integer,
  updated_by text
);
create table public.saves_backup (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  rev bigint,
  backed_up_at timestamptz not null default now()
);
insert into auth.users (id, email) values ('afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9','x@y.local');
