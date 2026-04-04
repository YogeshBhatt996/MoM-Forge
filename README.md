# MoM Forge

> AI-powered Minutes of Meeting generator — upload any transcript + Excel template, get a perfectly structured MoM in seconds.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Environment Variables](#environment-variables)
5. [Local Development Setup](#local-development-setup)
6. [Database Setup](#database-setup)
7. [Supabase Storage Setup](#supabase-storage-setup)
8. [Deploy to Vercel + Supabase](#deploy-to-vercel--supabase)
9. [Swapping the AI Provider](#swapping-the-ai-provider)
10. [Processing Pipeline](#processing-pipeline)
11. [API Reference](#api-reference)
12. [Business Rules](#business-rules)
13. [Extending MoM Forge](#extending-mom-forge)

---

## Overview

MoM Forge accepts:
- A **meeting transcript** (`.txt`, `.pdf`, or `.docx`)
- A **sample Excel MoM template** (`.xlsx`)

And produces:
- A downloadable **formatted Excel file** with all sections populated from the transcript
- A **job history dashboard** with status tracking and processing logs
- A **template library** so returning users skip re-uploading the same template

---

## Architecture

```
Browser  →  Next.js App Router (frontend + API routes)
              │
              ├── /api/upload        Upload files to Supabase Storage
              ├── /api/jobs          Create / list jobs
              ├── /api/jobs/:id      Fetch job detail
              ├── /api/process/:id   Run the MoM pipeline (sync MVP)
              ├── /api/download/:id  Generate signed download URL
              └── /api/templates     List / manage saved templates
              │
              └── lib/ services
                    ├── transcript/          Extract text (txt/pdf/docx)
                    ├── template-analysis/   Parse Excel template structure
                    ├── ai/                  AI provider abstraction + factory
                    │     ├── openai         GPT-4o
                    │     └── fake           Deterministic stub for dev/CI
                    ├── excel/               Generate output .xlsx
                    ├── jobs/                Orchestrate the full pipeline
                    ├── validation/          Zod schemas
                    └── supabase/            Client, server, storage helpers
```

### Key design decisions

| Decision | Rationale |
|---|---|
| AI behind an interface | Swap OpenAI → Anthropic → local LLM without touching calling code |
| Transcript extraction abstracted | Add new file types (audio, VTT) later in one place |
| Excel generation abstracted | Upgrade to an arbitrary template mapper without breaking the pipeline |
| Synchronous processing (MVP) | Drop-in queue (Inngest, Trigger.dev, BullMQ) by replacing one `processJob()` call |
| `AI_PROVIDER=fake` | Full local dev loop with zero API cost or latency |

---

## Project Structure

```
mom-forge/
├── app/
│   ├── (auth)/           login · register
│   ├── (app)/            protected layout + dashboard · jobs · templates · settings · admin
│   ├── api/              route handlers
│   └── globals.css
├── components/
│   ├── layout/           Nav · ThemeProvider
│   ├── ui/               StatusBadge
│   ├── upload/           UploadWizard
│   └── jobs/             JobsTable · JobDetailCard
├── lib/
│   ├── supabase/         client · server · storage
│   ├── ai/               interface · openai-provider · fake-provider · factory
│   ├── excel/            generator
│   ├── transcript/       index (txt + pdf + docx extractors)
│   ├── template-analysis/ index + prompt description helper
│   ├── jobs/             processor (full pipeline orchestration)
│   └── validation/       mom-schema · upload-schema
├── types/                shared TypeScript types
├── supabase/
│   └── schema.sql        all tables + RLS + seed prompt
├── middleware.ts          auth guard
└── README.md
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI Provider: "openai" | "fake"
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAX_UPLOAD_SIZE_BYTES=20971520

# Storage bucket names (must match what you create in Supabase)
SUPABASE_BUCKET_UPLOADS=uploads
SUPABASE_BUCKET_OUTPUTS=outputs
```

For **local development without LLM costs**, set `AI_PROVIDER=fake`. The fake provider returns a realistic stub MoM JSON and adds ~1.2s of artificial latency.

---

## Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env.local
# → fill in your Supabase keys + AI key (or set AI_PROVIDER=fake)

# 3. Run the dev server
npm run dev
# → http://localhost:3000
```

---

## Database Setup

1. Open your **Supabase project** → SQL Editor
2. Paste the contents of `supabase/schema.sql` and click **Run**

This creates:

| Table | Purpose |
|---|---|
| `users` | Mirrors `auth.users` with role field |
| `files` | Metadata for all uploaded/output files |
| `templates` | Saved Excel templates with parsed structure |
| `jobs` | One row per MoM generation job |
| `job_events` | Append-only audit log per job |
| `outputs` | Links a job to its generated Excel file |
| `prompt_versions` | Versioned AI prompt templates, admin-editable |

All tables have **Row Level Security** enabled. Users can only see their own data.

---

## Supabase Storage Setup

Create two private buckets via the Supabase dashboard or CLI:

```bash
# Using Supabase CLI
supabase storage create uploads --public=false
supabase storage create outputs --public=false
```

Or in the dashboard: **Storage → New bucket** → name `uploads` / `outputs`, toggle **Private**.

---

## Deploy to Vercel + Supabase

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "Initial MoM Forge"
git remote add origin https://github.com/your-org/mom-forge
git push -u origin main
```

### 2. Create Vercel project

- Go to [vercel.com/new](https://vercel.com/new) → import the GitHub repo
- Framework: **Next.js** (auto-detected)

### 3. Add environment variables in Vercel

Copy all variables from `.env.example` into the Vercel project settings.

For `SUPABASE_SERVICE_ROLE_KEY` — mark it as **Sensitive**.

### 4. Deploy

Vercel builds and deploys automatically on every push to `main`.

### 5. Run the schema on production Supabase

If using a separate production Supabase project, paste `supabase/schema.sql` into that project's SQL Editor.

---

## Swapping the AI Provider

All AI calls go through `lib/ai/interface.ts`:

```typescript
export interface AIProvider {
  extractMoM(
    transcriptText: string,
    templateDescription: string,
    promptTemplate: string
  ): Promise<MoMData>;
}
```

To add **Anthropic Claude**:

1. Create `lib/ai/anthropic-provider.ts` implementing `AIProvider`
2. Add a case to `lib/ai/factory.ts`:
   ```typescript
   case "anthropic": {
     const { AnthropicProvider } = require("./anthropic-provider");
     return new AnthropicProvider();
   }
   ```
3. Set `AI_PROVIDER=anthropic` in your env

---

## Processing Pipeline

```
POST /api/upload
  └─ Validate files
  └─ Upload to Supabase Storage (bucket: uploads)
  └─ Create file records in DB
  └─ Create template record in DB
  └─ Return { transcript_file_id, template_file_id, template_id }

POST /api/jobs
  └─ Create job record (status: uploaded)
  └─ Return { job_id }

POST /api/process/:id
  └─ Set status: queued
  └─ Set status: processing
  └─ Download transcript buffer from Storage
  └─ Extract text (txt / pdf / docx)
  └─ Download template buffer from Storage
  └─ Analyse template structure (sheets, columns, purpose)
  └─ Load active prompt_version from DB
  └─ Call AI provider → MoMData JSON
  └─ Validate JSON with Zod (fill missing fields with "Not specified in transcript")
  └─ Save ai_raw_json to job
  └─ Map MoMData → template structure (MVP: identity map; extend here)
  └─ Generate Excel workbook (Overview · Attendees · Discussion · Action Items)
  └─ Upload output to Storage (bucket: outputs)
  └─ Create file + output records
  └─ Set status: completed
  └─ Return { job_id, status }

GET /api/download/:id
  └─ Verify ownership
  └─ Generate signed URL (1-hour TTL)
  └─ Return { signed_url, file_name, expires_at }
```

### Making it async (production)

Replace the synchronous `await processJob(params.id)` call in `/api/process/[id]/route.ts` with a queue push:

```typescript
// e.g. Inngest
await inngest.send({ name: "mom/process", data: { job_id: params.id } });
```

Then create an Inngest function that calls `processJob(job_id)`.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload transcript + template files |
| `POST` | `/api/jobs` | Create a new job |
| `GET` | `/api/jobs` | List jobs (paginated) |
| `GET` | `/api/jobs/:id` | Get job detail with events + output |
| `POST` | `/api/process/:id` | Run the MoM pipeline |
| `GET` | `/api/download/:id` | Get signed download URL |
| `GET` | `/api/templates` | List saved templates |
| `POST` | `/api/templates` | Create/update a template |

All endpoints require a valid Supabase session cookie (set automatically by the auth helpers).

---

## Business Rules

These rules are enforced in the AI prompt template and validated by Zod schemas:

- **Transcript is the sole source of facts.** The AI may not invent or infer information.
- **Missing fields** are filled with `"Not specified in transcript"`.
- **Owner unclear** → `"Owner not clearly identified in transcript"`.
- **Summaries** are by topic, not by speaker (unless the template requires speaker columns).
- **Decisions** must be directly traceable to transcript content.
- **Action items** always output as: `{ action, owner, due_date, status_remarks }`.
- **Excel template** is the source of truth for output structure.

---

## Extending MoM Forge

### Add a smarter template mapper

The MVP uses a direct identity map (MoMData → fixed sheets). To support arbitrary templates:

1. Replace `lib/jobs/processor.ts` step 7 with a call to a smart mapper
2. The mapper receives `MoMData` + `TemplateStructure` and produces a row-by-row cell mapping
3. The Excel generator uses the mapping instead of hardcoded sheets

### Add a background queue

Replace `processJob()` invocation in `/api/process/[id]/route.ts` with an event dispatch (Inngest, BullMQ, Trigger.dev).

### Add webhook notifications

After `status: completed`, fire a webhook or email via Supabase Edge Functions.

### Add transcript audio support

Add a new extractor to `lib/transcript/index.ts` that calls the Whisper API for `.mp3`/`.mp4` files.
