// GET /api/jobs/:id – full job detail with events and output

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo-auth";
import { demoJobs, demoEvents, demoFiles, demoOutputs, getDemoUserFromToken } from "@/lib/demo-store";

const DEMO_COOKIE = "demo_session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode()) {
    const token = req.cookies.get(DEMO_COOKIE)?.value;
    const demoUser = token ? getDemoUserFromToken(token) : null;
    if (!demoUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const job = demoJobs.get(id);
    if (!job || job.userId !== demoUser.id) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const transcriptFile = demoFiles.get(job.transcriptFileId);
    const templateFile = job.templateFileId ? demoFiles.get(job.templateFileId) : null;
    const hasOutput = demoOutputs.has(id);
    return NextResponse.json({
      id: job.id,
      user_id: job.userId,
      status: job.status,
      error_message: job.errorMessage,
      ai_raw_json: job.aiRawJson,
      created_at: job.createdAt,
      updated_at: job.createdAt,
      transcript_file: transcriptFile ? { id: job.transcriptFileId, original_name: transcriptFile.originalName, size_bytes: transcriptFile.sizeBytes, mime_type: transcriptFile.mimeType } : null,
      template_file: templateFile ? { id: job.templateFileId, original_name: templateFile.originalName, size_bytes: templateFile.sizeBytes } : null,
      template: null,
      events: (demoEvents.get(id) ?? []).map((e) => ({ ...e, id: e.id, created_at: e.createdAt })),
      output: hasOutput ? { job_id: id, file: { original_name: `output_${id}.xlsx` } } : null,
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: job, error } = await service
    .from("jobs")
    .select(`
      *,
      transcript_file:files!transcript_file_id(*),
      template_file:files!template_file_id(*),
      template:templates(*),
      events:job_events(* order:created_at.asc),
      output:outputs(*, file:files(*))
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(job);
}
