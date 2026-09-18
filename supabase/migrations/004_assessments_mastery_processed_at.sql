-- ============================================================
-- AI Study Companion — Migration 004: Assessments Mastery Processed At
-- Adds mastery_processed_at to assessments table for idempotency
-- ============================================================

alter table public.assessments
  add column if not exists mastery_processed_at timestamptz;
