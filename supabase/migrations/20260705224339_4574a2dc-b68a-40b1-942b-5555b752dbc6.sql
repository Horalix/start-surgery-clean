
create extension if not exists pgcrypto;

create table if not exists public.battle_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('accuracy', 'speed')),
  question_ids text[] not null check (array_length(question_ids, 1) = 8),
  status text not null default 'waiting' check (status in ('waiting', 'running', 'finished', 'cancelled')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.battle_players (
  room_id uuid not null references public.battle_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  score integer not null default 0,
  correct_count integer not null default 0,
  total_ms integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.battle_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.battle_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  qid text not null,
  selected text[] not null,
  correct boolean not null,
  ms integer not null check (ms >= 0),
  answered_at timestamptz not null default now(),
  unique (room_id, user_id, qid)
);

grant select, insert, update, delete on public.battle_rooms to authenticated;
grant all on public.battle_rooms to service_role;
grant select, insert, update, delete on public.battle_players to authenticated;
grant all on public.battle_players to service_role;
grant select, insert, update, delete on public.battle_answers to authenticated;
grant all on public.battle_answers to service_role;

alter table public.battle_rooms enable row level security;
alter table public.battle_players enable row level security;
alter table public.battle_answers enable row level security;

create policy "rooms are visible to authenticated joiners and participants"
on public.battle_rooms
for select
to authenticated
using (
  auth.uid() is not null
  and (
    status = 'waiting'
    or host_user_id = auth.uid()
    or exists (
      select 1 from public.battle_players p
      where p.room_id = battle_rooms.id and p.user_id = auth.uid()
    )
  )
);

create policy "authenticated users can host rooms"
on public.battle_rooms
for insert
to authenticated
with check (auth.uid() is not null and host_user_id = auth.uid());

create policy "hosts can update their rooms"
on public.battle_rooms
for update
to authenticated
using (auth.uid() is not null and host_user_id = auth.uid())
with check (auth.uid() is not null and host_user_id = auth.uid());

create policy "players can see room rosters"
on public.battle_players
for select
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1 from public.battle_rooms r
    where r.id = battle_players.room_id
      and (
        r.status = 'waiting'
        or r.host_user_id = auth.uid()
        or exists (
          select 1 from public.battle_players mine
          where mine.room_id = r.id and mine.user_id = auth.uid()
        )
      )
  )
);

create policy "authenticated users can join waiting rooms as themselves"
on public.battle_players
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and exists (
    select 1 from public.battle_rooms r
    where r.id = room_id and r.status = 'waiting'
  )
);

create policy "players can update their own score row"
on public.battle_players
for update
to authenticated
using (auth.uid() is not null and user_id = auth.uid())
with check (auth.uid() is not null and user_id = auth.uid());

create policy "room participants can read battle answers"
on public.battle_answers
for select
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1 from public.battle_players p
    where p.room_id = battle_answers.room_id and p.user_id = auth.uid()
  )
);

create policy "players can submit their own answers"
on public.battle_answers
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and exists (
    select 1 from public.battle_players p
    where p.room_id = room_id and p.user_id = auth.uid()
  )
);

create policy "players can correct only their own answer rows"
on public.battle_answers
for update
to authenticated
using (auth.uid() is not null and user_id = auth.uid())
with check (auth.uid() is not null and user_id = auth.uid());

alter publication supabase_realtime add table public.battle_rooms;
alter publication supabase_realtime add table public.battle_players;
alter publication supabase_realtime add table public.battle_answers;
