alter table public.profiles
  add column if not exists xp               integer     not null default 0,
  add column if not exists study_level      integer     not null default 1,
  add column if not exists mastered_count   integer     not null default 0,
  add column if not exists seen_count       integer     not null default 0,
  add column if not exists study_accuracy   integer     not null default 0,
  add column if not exists study_score      integer     not null default 0,
  add column if not exists study_updated_at timestamptz not null default now();

create index if not exists profiles_study_score_idx
  on public.profiles (study_score desc);