-- ─────────────────────────────────────────────────────────────────────────────
-- MoM Forge – Seed Data (local dev only)
-- Run AFTER schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed a demo prompt version (already included in schema.sql as v1; this adds v2)
insert into public.prompt_versions (name, version, content, is_active)
values (
  'mom_extraction_v2_draft',
  2,
  '-- Draft v2 prompt (edit me in the Admin panel)',
  false
);
