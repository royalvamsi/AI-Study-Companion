-- ============================================================
-- AI Study Companion — Full Production Database Migration
-- Fully idempotent, least-privilege hardened & tested for fresh Supabase projects
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- Step 1: Enable pgvector extension
-- ============================================================
create extension if not exists vector;

-- ============================================================
-- Step 2: Generic Helper Functions (No table dependencies)
-- ============================================================

-- Auto-update updated_at timestamp trigger function
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Step 3: profiles table (Base identity table)
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  avatar_url   text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Step 4: Functions referencing profiles (is_admin & handle_new_user)
-- ============================================================

-- Helper function to check admin status without RLS recursion
-- Created AFTER public.profiles exists to satisfy parser dependencies
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Explicit least-privilege: only authenticated sessions and backend service role need this
revoke all on function public.is_admin from public, anon;
grant execute on function public.is_admin to authenticated, service_role;

-- Auto-create/update profile on auth signup (crash-proof)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Student'
    )
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_user from public, anon, authenticated;
grant execute on function public.handle_new_user to postgres, service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Step 5: spaces
-- ============================================================
create table if not exists public.spaces (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists spaces_user_id_idx on public.spaces(user_id);

drop trigger if exists set_spaces_updated_at on public.spaces;
create trigger set_spaces_updated_at
  before update on public.spaces
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Step 6: projects
-- ============================================================
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  description   text,
  learning_goal text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists projects_space_id_idx on public.projects(space_id);
create index if not exists projects_user_id_idx  on public.projects(user_id);

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Step 7: materials
-- ============================================================
do $$ begin
  create type public.material_status as enum ('queued', 'processing', 'ready', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.materials (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  file_name     text not null,
  file_path     text not null,
  file_type     text not null default 'application/pdf',
  status        public.material_status not null default 'queued',
  page_count    integer,
  size_bytes    bigint,
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists materials_project_id_idx on public.materials(project_id);
create index if not exists materials_user_id_idx    on public.materials(user_id);
create index if not exists materials_status_idx     on public.materials(status);

drop trigger if exists set_materials_updated_at on public.materials;
create trigger set_materials_updated_at
  before update on public.materials
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Step 8: material_chunks (with pgvector)
-- ============================================================
create table if not exists public.material_chunks (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references public.materials(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  content      text not null,
  chunk_index  integer not null,
  page_number  integer,
  embedding    vector(1536),
  created_at   timestamptz not null default now()
);

create index if not exists material_chunks_project_id_idx     on public.material_chunks(project_id);
create index if not exists material_chunks_material_id_idx    on public.material_chunks(material_id);
create index if not exists material_chunks_embedding_hnsw_idx on public.material_chunks using hnsw (embedding vector_cosine_ops);

-- ============================================================
-- Step 9: concepts
-- ============================================================
create table if not exists public.concepts (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  source_material_id uuid references public.materials(id) on delete cascade,
  name               text not null,
  description        text,
  prerequisite_depth integer not null default 0,
  created_at         timestamptz not null default now()
);

create index if not exists concepts_project_id_idx         on public.concepts(project_id);
create index if not exists concepts_source_material_id_idx on public.concepts(source_material_id);

-- ============================================================
-- Step 10: conversations
-- ============================================================
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null default 'New Conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_project_id_idx on public.conversations(project_id);
create index if not exists conversations_user_id_idx    on public.conversations(user_id);

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
  before update on public.conversations
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Step 11: messages
-- ============================================================
do $$ begin
  create type public.evidence_state as enum ('SUPPORTED', 'PARTIALLY_SUPPORTED', 'INSUFFICIENT_EVIDENCE');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.message_role as enum ('user', 'assistant', 'system');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            public.message_role not null,
  content         text not null,
  sources         jsonb,
  evidence_state  public.evidence_state,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages(conversation_id);

-- ============================================================
-- Step 12: learning_context
-- ============================================================
create table if not exists public.learning_context (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  learning_goal     text,
  strengths         text[] not null default '{}',
  weaknesses        text[] not null default '{}',
  preferences       text[] not null default '{}',
  important_context text[] not null default '{}',
  updated_at        timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists learning_context_project_id_idx on public.learning_context(project_id);

drop trigger if exists set_learning_context_updated_at on public.learning_context;
create trigger set_learning_context_updated_at
  before update on public.learning_context
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Step 13: concept_mastery
-- ============================================================
create table if not exists public.concept_mastery (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  concept_id       uuid not null references public.concepts(id) on delete cascade,
  mastery_score    numeric(5,2) not null default 0,
  previous_score   numeric(5,2),
  trend            text check (trend in ('IMPROVING', 'STABLE', 'NEEDS_ATTENTION')),
  assessment_count integer not null default 0,
  last_assessed_at timestamptz,
  updated_at       timestamptz not null default now(),
  unique (project_id, user_id, concept_id)
);

create index if not exists concept_mastery_project_id_idx on public.concept_mastery(project_id);
create index if not exists concept_mastery_user_id_idx    on public.concept_mastery(user_id);

drop trigger if exists set_concept_mastery_updated_at on public.concept_mastery;
create trigger set_concept_mastery_updated_at
  before update on public.concept_mastery
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Step 14: assessments
-- ============================================================
do $$ begin
  create type public.assessment_status as enum ('in_progress', 'completed', 'abandoned');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.assessments (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  status         public.assessment_status not null default 'in_progress',
  question_count integer not null default 0,
  score          numeric(5,2),
  started_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists assessments_project_id_idx on public.assessments(project_id);
create index if not exists assessments_user_id_idx    on public.assessments(user_id);

-- ============================================================
-- Step 15: assessment_questions
-- ============================================================
do $$ begin
  create type public.question_type as enum ('mcq', 'open_ended');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.assessment_questions (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  concept_id      uuid references public.concepts(id) on delete set null,
  question_type   public.question_type not null,
  question_text   text not null,
  options         jsonb,
  correct_answer  text,
  difficulty      integer check (difficulty between 1 and 5) not null default 3,
  user_answer     text,
  is_correct      boolean,
  score           numeric(5,2),
  feedback        text,
  llm_response    jsonb,
  answered_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists assessment_questions_assessment_id_idx on public.assessment_questions(assessment_id);
create index if not exists assessment_questions_concept_id_idx    on public.assessment_questions(concept_id);

-- ============================================================
-- Step 16: mistakes
-- ============================================================
create table if not exists public.mistakes (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  concept_id        uuid references public.concepts(id) on delete cascade,
  question_id       uuid references public.assessment_questions(id) on delete set null,
  question_text     text,
  user_answer       text,
  correct_answer    text,
  explanation       text,
  description       text,
  mistake_type      text,
  occurrence_count  integer not null default 1,
  first_occurred_at timestamptz not null default now(),
  last_occurred_at  timestamptz not null default now()
);

create index if not exists mistakes_project_id_idx on public.mistakes(project_id);
create index if not exists mistakes_concept_id_idx on public.mistakes(concept_id);
create index if not exists mistakes_user_id_idx    on public.mistakes(user_id);

-- ============================================================
-- Step 17: recommendations
-- ============================================================
create table if not exists public.recommendations (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  concept_id   uuid references public.concepts(id) on delete cascade,
  priority     text check (priority in ('HIGH', 'MEDIUM', 'LOW')) not null default 'MEDIUM',
  action_type  text not null,
  reasoning    text,
  is_dismissed boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists recommendations_project_id_idx on public.recommendations(project_id);
create index if not exists recommendations_user_id_idx    on public.recommendations(user_id);

-- ============================================================
-- Step 18: activity_events
-- ============================================================
create table if not exists public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_project_id_idx on public.activity_events(project_id);
create index if not exists activity_events_user_id_idx    on public.activity_events(user_id);
create index if not exists activity_events_created_at_idx on public.activity_events(created_at desc);

-- ============================================================
-- Step 19: ai_usage_logs (telemetry & audit)
-- ============================================================
create table if not exists public.ai_usage_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles(id) on delete set null,
  project_id         uuid references public.projects(id) on delete set null,
  feature            text not null,
  model              text not null,
  latency_ms         integer,
  input_tokens       integer,
  output_tokens      integer,
  estimated_cost_usd numeric(10,6),
  status             text check (status in ('success', 'error')) not null default 'success',
  error              text,
  created_at         timestamptz not null default now()
);

create index if not exists ai_usage_logs_user_id_idx    on public.ai_usage_logs(user_id);
create index if not exists ai_usage_logs_feature_idx    on public.ai_usage_logs(feature);
create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs(created_at desc);

-- ============================================================
-- Step 20: Row Level Security (RLS) Policies
-- (Created after all tables and is_admin() exist)
-- ============================================================
alter table public.profiles             enable row level security;
alter table public.spaces               enable row level security;
alter table public.projects             enable row level security;
alter table public.materials            enable row level security;
alter table public.material_chunks      enable row level security;
alter table public.concepts             enable row level security;
alter table public.conversations        enable row level security;
alter table public.messages             enable row level security;
alter table public.learning_context     enable row level security;
alter table public.concept_mastery      enable row level security;
alter table public.mistakes             enable row level security;
alter table public.assessments          enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.recommendations      enable row level security;
alter table public.activity_events      enable row level security;
alter table public.ai_usage_logs        enable row level security;

-- profiles: Uses is_admin() security definer to avoid infinite policy recursion
drop policy if exists "users_own_profile" on public.profiles;
create policy "users_own_profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "admins_read_all_profiles" on public.profiles;
create policy "admins_read_all_profiles" on public.profiles
  for select using (public.is_admin());

-- spaces
drop policy if exists "spaces_owner" on public.spaces;
create policy "spaces_owner" on public.spaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- projects
drop policy if exists "projects_owner" on public.projects;
create policy "projects_owner" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- materials
drop policy if exists "materials_owner" on public.materials;
create policy "materials_owner" on public.materials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- material_chunks (read-only for project owner; service role writes)
drop policy if exists "material_chunks_project_owner" on public.material_chunks;
create policy "material_chunks_project_owner" on public.material_chunks
  for select using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- concepts
drop policy if exists "concepts_project_owner" on public.concepts;
create policy "concepts_project_owner" on public.concepts
  for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

-- conversations
drop policy if exists "conversations_owner" on public.conversations;
create policy "conversations_owner" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages
drop policy if exists "messages_conversation_owner" on public.messages;
create policy "messages_conversation_owner" on public.messages
  for all
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- learning_context
drop policy if exists "learning_context_owner" on public.learning_context;
create policy "learning_context_owner" on public.learning_context
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- concept_mastery
drop policy if exists "concept_mastery_owner" on public.concept_mastery;
create policy "concept_mastery_owner" on public.concept_mastery
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- mistakes
drop policy if exists "mistakes_owner" on public.mistakes;
create policy "mistakes_owner" on public.mistakes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- assessments
drop policy if exists "assessments_owner" on public.assessments;
create policy "assessments_owner" on public.assessments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- assessment_questions
drop policy if exists "assessment_questions_owner" on public.assessment_questions;
create policy "assessment_questions_owner" on public.assessment_questions
  for all
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

-- recommendations
drop policy if exists "recommendations_owner" on public.recommendations;
create policy "recommendations_owner" on public.recommendations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- activity_events
drop policy if exists "activity_events_select" on public.activity_events;
create policy "activity_events_select" on public.activity_events
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "activity_events_insert" on public.activity_events;
create policy "activity_events_insert" on public.activity_events
  for insert with check (auth.uid() = user_id);

-- ai_usage_logs (admin-only read; service role writes)
drop policy if exists "ai_usage_logs_admin_read" on public.ai_usage_logs;
create policy "ai_usage_logs_admin_read" on public.ai_usage_logs
  for select using (public.is_admin());

-- ============================================================
-- Step 21: pgvector similarity search function
-- (Created after material_chunks, projects, and is_admin exist)
-- ============================================================
create or replace function public.match_chunks(
  query_embedding  vector(1536),
  match_project_id uuid,
  match_count      int   default 8,
  match_threshold  float default 0.70
)
returns table (
  id          uuid,
  material_id uuid,
  content     text,
  page_number integer,
  similarity  float
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Enforce strict Space/Project data isolation:
  -- Only service_role/postgres, admin users, or the project owner may retrieve chunks.
  if not (
    current_user in ('postgres', 'service_role')
    or auth.role() = 'service_role'
    or public.is_admin()
    or exists (
      select 1
      from public.projects p
      where p.id = match_project_id
        and p.user_id = auth.uid()
    )
  ) then
    return;
  end if;

  return query
  select
    mc.id,
    mc.material_id,
    mc.content,
    mc.page_number,
    (1 - (mc.embedding <=> query_embedding))::float as similarity
  from public.material_chunks mc
  where
    mc.project_id   = match_project_id
    and mc.embedding is not null
    and (1 - (mc.embedding <=> query_embedding)) > match_threshold
  order by mc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Deny anonymous access; grant strictly to authenticated users and service_role
revoke all on function public.match_chunks from public, anon;
grant execute on function public.match_chunks to authenticated, service_role;

-- ============================================================
-- Step 22: Storage Bucket & Policies for PDF Study Materials
-- ============================================================
-- Create private 'materials' bucket for study document uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materials', 'materials', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Student can only upload PDFs into their own folder: userId/projectId/materialId/file.pdf
drop policy if exists "materials_storage_upload" on storage.objects;
create policy "materials_storage_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Student can read/download files within their own folder (admins can read all)
drop policy if exists "materials_storage_read" on storage.objects;
create policy "materials_storage_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materials'
    and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin())
  );

-- Student can update their own uploaded files
drop policy if exists "materials_storage_update" on storage.objects;
create policy "materials_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'materials'
    and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin())
  );

-- Student can delete their own uploaded files
drop policy if exists "materials_storage_delete" on storage.objects;
create policy "materials_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materials'
    and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin())
  );

-- ============================================================
-- Step 23: Least-Privilege Role Permissions
-- ============================================================
-- Schema usage
grant usage on schema public to anon, authenticated, service_role;

-- Service role: full access for backend orchestration & background workers (Inngest)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- Authenticated role: CRUD permissions governed strictly by Row Level Security (RLS)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

-- Anon role: Restrict completely. Zero table modification privileges.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines in schema public from anon;

-- Default privileges for future tables/sequences created in public schema
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines to service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage on sequences to authenticated;

-- Explicit routine security: lock down RPC execution to intended roles only
revoke all on function public.is_admin from public, anon;
revoke all on function public.match_chunks from public, anon;
revoke all on function public.handle_new_user from public, anon, authenticated;

grant execute on function public.is_admin to authenticated, service_role;
grant execute on function public.match_chunks to authenticated, service_role;
grant execute on function public.handle_new_user to postgres, service_role;
