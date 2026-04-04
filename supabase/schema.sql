-- ─────────────────────────────────────────────────────────────────────────────
-- MoM Forge – Supabase SQL Schema + RLS Policies
-- Run this in the Supabase SQL Editor (or via supabase db push)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Custom types ─────────────────────────────────────────────────────────────

create type job_status as enum (
  'uploaded',
  'queued',
  'processing',
  'completed',
  'failed',
  'requires_review'
);

create type file_type as enum (
  'transcript',
  'template',
  'output'
);

-- ─── Users (mirrors auth.users) ──────────────────────────────────────────────

create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  role          text not null default 'user',         -- 'user' | 'admin'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Automatically create a public.users row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users(id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Files ───────────────────────────────────────────────────────────────────

create table public.files (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  name          text not null,
  original_name text not null,
  mime_type     text not null,
  size_bytes    bigint not null,
  file_type     file_type not null,
  storage_path  text not null,           -- supabase storage path
  created_at    timestamptz not null default now()
);

-- ─── Templates ───────────────────────────────────────────────────────────────

create table public.templates (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  file_id         uuid not null references public.files(id) on delete cascade,
  name            text not null,
  description     text,
  structure_json  jsonb,                 -- parsed column/sheet metadata
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── Jobs ────────────────────────────────────────────────────────────────────

create table public.jobs (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.users(id) on delete cascade,
  transcript_file_id  uuid not null references public.files(id),
  template_id         uuid references public.templates(id),
  template_file_id    uuid references public.files(id),
  status              job_status not null default 'uploaded',
  error_message       text,
  ai_raw_json         jsonb,             -- raw JSON from AI extraction
  mapped_json         jsonb,             -- after template mapping
  retry_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── Job Events (audit log) ───────────────────────────────────────────────────

create table public.job_events (
  id          uuid primary key default uuid_generate_v4(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  status      job_status not null,
  message     text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ─── Outputs ─────────────────────────────────────────────────────────────────

create table public.outputs (
  id            uuid primary key default uuid_generate_v4(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  file_id       uuid not null references public.files(id),
  download_url  text,                    -- signed URL cached value (optional)
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- ─── Prompt Versions ─────────────────────────────────────────────────────────

create table public.prompt_versions (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  version     int not null default 1,
  content     text not null,
  is_active   boolean not null default false,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  unique(name, version)
);

-- ─── Updated_at triggers ─────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_users_updated_at        before update on public.users        for each row execute procedure public.set_updated_at();
create trigger set_templates_updated_at    before update on public.templates    for each row execute procedure public.set_updated_at();
create trigger set_jobs_updated_at         before update on public.jobs         for each row execute procedure public.set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_files_user_id     on public.files(user_id);
create index idx_templates_user_id on public.templates(user_id);
create index idx_jobs_user_id      on public.jobs(user_id);
create index idx_jobs_status       on public.jobs(status);
create index idx_job_events_job_id on public.job_events(job_id);
create index idx_outputs_job_id    on public.outputs(job_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.users          enable row level security;
alter table public.files          enable row level security;
alter table public.templates      enable row level security;
alter table public.jobs           enable row level security;
alter table public.job_events     enable row level security;
alter table public.outputs        enable row level security;
alter table public.prompt_versions enable row level security;

-- Users: see/edit only own profile; admins see all
create policy "users: own row" on public.users
  for all using (auth.uid() = id);

create policy "users: admin see all" on public.users
  for select using (
    exists(select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Files
create policy "files: own" on public.files
  for all using (user_id = auth.uid());

-- Templates
create policy "templates: own" on public.templates
  for all using (user_id = auth.uid());

-- Jobs
create policy "jobs: own" on public.jobs
  for all using (user_id = auth.uid());

-- Job Events
create policy "job_events: via job" on public.job_events
  for select using (
    exists(select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  );

-- Outputs
create policy "outputs: via job" on public.outputs
  for select using (
    exists(select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid())
  );

-- Prompt versions: read-only for users, write for admins
create policy "prompt_versions: read all" on public.prompt_versions
  for select using (auth.uid() is not null);

create policy "prompt_versions: admin write" on public.prompt_versions
  for all using (
    exists(select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- ─── Seed: default prompt version ────────────────────────────────────────────

insert into public.prompt_versions (name, version, content, is_active)
values (
  'mom_extraction',
  1,
  'You are an expert business documentation assistant specializing in creating professional Minutes of Meeting (MoM) documents.

Your task is to extract structured meeting information from the provided transcript and return a normalized JSON object that matches the logical structure of the provided Excel template.

## Core Rules
1. The transcript is the SOLE source of factual content. Never invent, infer, or embellish facts.
2. If a field exists in the template but has no corresponding information in the transcript, set its value to "Not specified in transcript".
3. Summarize by TOPIC, not by speaker, unless the template explicitly requires speaker attribution.
4. All decisions must be directly traceable to transcript content.
5. Use concise, professional language throughout.
6. Action items MUST follow this exact structure:
   { "action": "...", "owner": "...", "due_date": "...", "status_remarks": "..." }
   - If owner is unclear: "Owner not clearly identified in transcript"
   - If due date is missing: "Not specified in transcript"

## Output Format
Return ONLY valid JSON. Do not include prose, markdown fences, or commentary outside the JSON object.

The JSON must include:
- meeting_title: string
- meeting_date: string (ISO format if determinable, else as stated)
- meeting_time: string
- location_or_platform: string
- facilitator: string
- attendees: Array<{ name: string, role: string, organization: string }>
- agenda_items: Array<string>
- discussion_summary: Array<{ topic: string, summary: string, decisions: Array<string> }>
- action_items: Array<{ action: string, owner: string, due_date: string, status_remarks: string }>
- next_meeting: { date: string, time: string, agenda: string }
- additional_notes: string

## Template Sections
{{TEMPLATE_SECTIONS}}

## Transcript
{{TRANSCRIPT}}',
  true
);

-- ─── Storage Buckets (run via Supabase dashboard or CLI) ─────────────────────
-- supabase storage create uploads --public=false
-- supabase storage create outputs --public=false
