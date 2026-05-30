create table if not exists todo_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#E8C56A',
  created_at timestamptz not null default now()
);
alter table todo_lists enable row level security;
create policy "todo_lists: user owns" on todo_lists
  for all using (auth.uid() = user_id);

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid references todo_lists(id) on delete set null,
  title text not null,
  done boolean not null default false,
  priority text not null default 'medium',
  due_date date,
  created_at timestamptz not null default now()
);
alter table todos enable row level security;
create policy "todos: user owns" on todos
  for all using (auth.uid() = user_id);
