-- ============================================================
-- AI Study Companion — Migration 005: Increase Materials Bucket to 50MB
-- Updates materials storage bucket file_size_limit to 52428800 (50MB)
-- and ensures all canonical document types (PDF, Word, PPTX, Markdown, Text) are allowed.
-- ============================================================

update storage.buckets
set 
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/pptx'
  ]
where id = 'materials';
