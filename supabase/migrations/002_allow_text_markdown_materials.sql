-- ============================================================
-- AI Study Companion — Migration 002: Allow Text & Markdown Uploads
-- Adds text/plain, text/markdown, and text/x-markdown to materials storage bucket
-- ============================================================

update storage.buckets
set allowed_mime_types = array['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown']
where id = 'materials';
