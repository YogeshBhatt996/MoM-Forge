// POST /api/jobs  – create a new job
// GET  /api/jobs  – list jobs for current user

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { isDemoMode } from "@/lib/demo-auth";
import { demoJobs, demoEvents, demoFiles, getDemoUserFromToken } from "@/lib/demo-store";

const DEMO_COOKIE = "demo_session";

const createJobSchema = z.object({
  transcript_file_id: z.string().uuid(),
  template_file_id: z.string().uuid(),
  template_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    const token = req.cookies.get(DEMO_COOKIE)?.value;
    const demoUser = token ? getDemoUserFromToken(token) : null;
    if (!demoUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const jobId = uuidv4();
    demoJobs.set(jobId, {
      id: jobId,
      userId: demoUser.id,
      transcriptFileId: parsed.data.transcript_file_id,
      templateFileId: parsed.data.template_file_id,
      templateId: parsed.data.template_id ?? null,
      status: "uploaded",
      errorMessage: null,
      aiRawJson: null,
      createdAt: new Date().toISOString(),
    });
    demoEvents.set(jobId, [{ id: uuidv4(), jobId, status: "uploaded", message: "Job created – files uploaded", createdAt: new Date().toISOString() }]);
    return NextResponse.json({ job_id: jobId }, { status: 201 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = createServiceClient();
  const jobId = uuidv4();
  const { error } = await service.from("jobs").insert({
    id: jobId,
    user_id: user.id,
    transcript_file_id: parsed.data.transcript_file_id,
    template_file_id: parsed.data.template_file_id,
    template_id: parsed.data.template_id ?? null,
    status: "uploaded",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the initial event
  await service.from("job_events").insert({
    job_id: jobId,
    status: "uploaded",
    message: "Job created – files uploaded",
  });

  return NextResponse.json({ job_id: jobId }, { status: 201 });
}

export async function GET(req: NextRequest) {
  if (isDemoMode()) {
    const token = req.cookies.get(DEMO_COOKIE)?.value;
    const demoUser = token ? getDemoUserFromToken(token) : null;
    if (!demoUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const jobs = Array.from(demoJobs.values())
      .filter((j) => j.userId === demoUser.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((j) => ({
        ...j,
        transcript_file: demoFiles.get(j.transcriptFileId)
          ? { original_name: demoFiles.get(j.transcriptFileId)!.originalName, size_bytes: demoFiles.get(j.transcriptFileId)!.sizeBytes }
          : null,
      }));
    return NextResponse.json({ jobs, total: jobs.length, page: 1, limit: 20 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const offset = (page - 1) * limit;

  const service = createServiceClient();
  const { data, error, count } = await service
    .from("jobs")
    .select("*, transcript_file:files!transcript_file_id(*)", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: data, total: count, page, limit });
}
