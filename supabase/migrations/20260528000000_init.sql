-- =============================================================
-- Timespace initial schema
-- =============================================================

-- Profiles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================
-- Tasks (self-referencing tree)
-- =============================================================

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references tasks(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  notes text,
  color text default '#7F77DD',
  recurrence_rule text,
  notification_minutes_before int,
  depth int not null default 0,
  sort_order int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_time_valid check (end_at > start_at)
);

create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists tasks_parent_id_idx on tasks(parent_id);
create index if not exists tasks_user_time_idx on tasks(user_id, start_at, end_at);

alter table tasks enable row level security;

create policy "tasks_select_own" on tasks
  for select using (auth.uid() = user_id);
create policy "tasks_insert_own" on tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks_update_own" on tasks
  for update using (auth.uid() = user_id);
create policy "tasks_delete_own" on tasks
  for delete using (auth.uid() = user_id);

-- Auto-compute depth from parent
create or replace function compute_task_depth()
returns trigger language plpgsql as $$
begin
  if new.parent_id is null then
    new.depth := 0;
  else
    select depth + 1 into new.depth from tasks where id = new.parent_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_set_depth on tasks;
create trigger tasks_set_depth
  before insert or update of parent_id on tasks
  for each row execute function compute_task_depth();

-- Touch updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_touch on tasks;
create trigger tasks_touch
  before update on tasks
  for each row execute function touch_updated_at();

-- =============================================================
-- Goals (future-back roadmap)
-- =============================================================

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references goals(id) on delete cascade,
  title text not null,
  target_value numeric,
  unit text,
  target_date date,
  current_value numeric default 0,
  strategy_type text check (strategy_type in ('savings', 'habit', 'skill', 'revenue', 'custom')),
  linked_task_id uuid references tasks(id) on delete set null,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_id_idx on goals(user_id);
create index if not exists goals_parent_id_idx on goals(parent_id);

alter table goals enable row level security;

create policy "goals_select_own" on goals
  for select using (auth.uid() = user_id);
create policy "goals_insert_own" on goals
  for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on goals
  for update using (auth.uid() = user_id);
create policy "goals_delete_own" on goals
  for delete using (auth.uid() = user_id);

drop trigger if exists goals_touch on goals;
create trigger goals_touch
  before update on goals
  for each row execute function touch_updated_at();
