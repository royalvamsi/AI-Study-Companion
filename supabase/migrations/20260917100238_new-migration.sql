-- ============================================================
-- AI Study Companion — Migration: Recommendations Status & History Tracking
-- Adds status tracking, updated_at, and partial unique index on active recommendations
-- ============================================================

-- 1. Add status column with check constraint
alter table public.recommendations
  add column if not exists status text not null default 'active'
  check (status in ('active', 'superseded', 'resolved'));

-- 2. Add updated_at timestamp column
alter table public.recommendations
  add column if not exists updated_at timestamptz not null default now();

-- 3. Backfill status based on existing is_dismissed flag
update public.recommendations
  set status = 'resolved'
  where is_dismissed = true;

update public.recommendations
  set status = 'active'
  where is_dismissed = false;

-- 4. Create partial unique index: at most one active recommendation per concept per project & user
create unique index if not exists recommendations_active_concept_idx
  on public.recommendations (project_id, user_id, concept_id)
  where status = 'active';

-- 5. Auto-update updated_at timestamp on row modification
drop trigger if exists set_recommendations_updated_at on public.recommendations;
create trigger set_recommendations_updated_at
  before update on public.recommendations
  for each row execute function public.handle_updated_at();
